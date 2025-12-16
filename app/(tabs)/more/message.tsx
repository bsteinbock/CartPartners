import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { iosKeyboardToolbarOffset } from '@/constants/theme';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SMS from 'expo-sms';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet } from 'react-native';
import { FlatList, Switch } from 'react-native-gesture-handler';
import { KeyboardAvoidingView, KeyboardToolbar } from 'react-native-keyboard-controller';
export default function MessageScreen() {
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const { league_players, leagues, currentLeagueId } = useDbStore();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [groupCoordinatorId, setGroupCoordinatorId] = useState<number>(0);
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const league = leagues.find((l) => l.id === currentLeagueId);
  const [isSmsAvailable, setIsSmsAvailable] = useState<boolean>(false);

  // Check SMS availability on mount
  useEffect(() => {
    (async () => {
      const available = await SMS.isAvailableAsync();
      setIsSmsAvailable(available);
    })();
  }, []);

  useEffect(() => {
    setAvailablePlayers(league_players.filter((p) => p.available));
  }, [league_players]);

  useFocusEffect(
    React.useCallback(() => {
      // Load saved number on mount
      (async () => {
        const coordinatorIdString = await SecureStore.getItemAsync('cartPartnerGroupCoordinatorId');
        const coordinatorId: number = coordinatorIdString ? parseInt(coordinatorIdString, 10) : 0;
        setGroupCoordinatorId(coordinatorId);
      })();
    }, []),
  );

  // Toggle a player's selection
  const togglePlayer = (playerId: number) => {
    setSelectedPlayerIds((prev) => {
      const newSelection = prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId];
      return newSelection;
    });
  };

  // Select or clear all players
  const toggleAllPlayers = () => {
    const allIds = league_players.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPlayerIds.includes(id));
    const newSelection = allSelected ? [] : allIds;
    setSelectedPlayerIds(newSelection);
  };

  const allSelected =
    league_players.length > 0 && league_players.every((p) => selectedPlayerIds.includes(p.id));
  const playerLabel = `Player (${selectedPlayerIds.length} of ${league_players.length} Selected)`;

  const sendEmail = () => {
    const selectedPlayers = league_players.filter((p) => selectedPlayerIds.includes(p.id));
    const addresses = encodeURIComponent(
      selectedPlayers
        .map((player) => player.email ?? '')
        .filter((m) => m.length > 0)
        .join(','),
    );
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(message);
    const url = `mailto:?to=${addresses}&subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open mail app');
    });
  };

  const sendTextMessage = async () => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS not available on this device');
      return;
    }

    const selectedPlayers = league_players.filter(
      (p) => selectedPlayerIds.includes(p.id) && p.id !== groupCoordinatorId,
    );

    const mobileNumbers = selectedPlayers
      .map((player) => player.mobile_number ?? '')
      .filter((a) => a.length > 0);

    if (mobileNumbers.length === 0) {
      Alert.alert('No valid mobile numbers found');
      return;
    }

    const fullMessage = title ? `${title}\n\n${message}` : message;

    const chunkSize = 20;
    let numberGroups: string[][] = [];

    // Split into raw chunks of 20
    for (let i = 0; i < mobileNumbers.length; i += chunkSize) {
      numberGroups.push(mobileNumbers.slice(i, i + chunkSize));
    }

    // --- Recipient balancing logic ---
    if (numberGroups.length > 1) {
      const lastGroup = numberGroups[numberGroups.length - 1];
      const secondLastGroup = numberGroups[numberGroups.length - 2];

      // If the last group has too few recipients (e.g. ≤ 5),
      // pull some from the previous group
      if (lastGroup.length <= 5 && secondLastGroup.length > 5) {
        const needed = 6 - lastGroup.length; // aim for ~6+ per final group
        const moved = secondLastGroup.splice(-needed);
        numberGroups[numberGroups.length - 1] = [...moved, ...lastGroup];
      }
    }

    // Confirm before sending multiple messages
    if (numberGroups.length > 1) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Multiple Messages Required',
          `You have ${mobileNumbers.length} recipients. ` +
            `This will send ${numberGroups.length} separate messages (max 20 per message). Proceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'OK', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    try {
      for (let i = 0; i < numberGroups.length; i++) {
        const group = numberGroups[i];
        if (numberGroups.length > 1) {
          Alert.alert(`Sending message ${i + 1} of ${numberGroups.length}...`);
        }
        await SMS.sendSMSAsync(group, fullMessage);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      Alert.alert('Failed to send one or more messages.');
    }
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.container} behavior={'padding'} keyboardVerticalOffset={132}>
        <ThemedView style={styles.inputsContainer}>
          <ThemedTextInput
            style={[styles.title, { marginTop: 12 }]}
            placeholder="Enter Message Subject"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />
          <ThemedTextInput
            style={[styles.input, { marginTop: 6 }]}
            numberOfLines={6}
            multiline={true}
            placeholder="Enter Message"
            value={message}
            onChangeText={setMessage}
            returnKeyType="next"
          />
        </ThemedView>
        <ThemedView style={{ flex: 1 }}>
          {availablePlayers.length === 0 ? (
            <ThemedView style={[styles.stepContainer, { margin: 12 }]}>
              <ThemedText>
                No players available. Go to Players Management screen using the icon on the top right of this
                screen.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: 1,
                  borderColor: '#ddd',
                  marginLeft: 15,
                  paddingBottom: 5,
                  gap: 30,
                }}
              >
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Switch
                    trackColor={{ true: switchTrackColor }}
                    value={allSelected}
                    onValueChange={toggleAllPlayers}
                    disabled={league_players.length === 0}
                  />
                </ThemedView>
                <ThemedView>
                  <ThemedText style={{ fontWeight: '700' }}>{playerLabel}</ThemedText>
                  <ThemedText type="small" style={{ marginTop: 4 }}>
                    {league?.name}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <FlatList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                data={availablePlayers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <ThemedView
                    style={{
                      padding: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Switch
                        trackColor={{ true: switchTrackColor }}
                        value={selectedPlayerIds.includes(item.id)}
                        onValueChange={(_val) => {
                          void togglePlayer(item.id);
                        }}
                      />
                      <ThemedText style={{ marginLeft: 30 }}>{item.name}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                )}
              />
            </>
          )}
        </ThemedView>
        <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <ThemedView
            style={{
              margin: 10,
              flex: 1,
              borderColor:
                selectedPlayerIds.length === 0 || message.length === 0 || title.length === 0
                  ? textDim
                  : iconButton,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton
              title="Email"
              disabled={selectedPlayerIds.length === 0 || message.length === 0 || title.length === 0}
              onPress={sendEmail}
            />
          </ThemedView>
          {isSmsAvailable && (
            <ThemedView
              style={{
                flex: 1,
                margin: 10,
                borderColor: selectedPlayerIds.length === 0 || message.length === 0 ? textDim : iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton
                title="Text Msg"
                disabled={selectedPlayerIds.length === 0 || message.length === 0}
                onPress={sendTextMessage}
              />
            </ThemedView>
          )}
        </ThemedView>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && <KeyboardToolbar offset={{ opened: iosKeyboardToolbarOffset }} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputsContainer: { marginHorizontal: 10 },
  title: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    height: 90,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
