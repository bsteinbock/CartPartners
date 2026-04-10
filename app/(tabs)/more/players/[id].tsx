import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { StyledHeaderBackButton } from '@/components/ui/StyledHeaderBackButton';
import ThemedButton from '@/components/ui/ThemedButton';
import { iosKeyboardToolbarOffset } from '@/constants/theme';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164, formatPhoneNumberToE164, generateNickname } from '@/lib/cart-utils';
import Entypo from '@expo/vector-icons/Entypo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');

  const { all_players, addPlayer, updatePlayer } = useDbStore();
  const currentPlayerIndex = useMemo(
    () => (isNew ? -1 : all_players.findIndex((p) => p.id === Number(id))),
    [all_players, id, isNew],
  );
  const previousPlayerId = currentPlayerIndex > 0 ? all_players[currentPlayerIndex - 1].id : null;
  const nextPlayerId =
    currentPlayerIndex >= 0 && currentPlayerIndex < all_players.length - 1
      ? all_players[currentPlayerIndex + 1].id
      : null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [speedIndex, setSpeedIndex] = useState('');
  const existingPlayer = useMemo(
    () => (isNew ? null : (all_players.find((p) => p.id === Number(id)) ?? null)),
    [all_players, id, isNew],
  );

  useEffect(() => {
    if (existingPlayer) {
      setName(existingPlayer.name);
      setEmail(existingPlayer.email || '');
      setSpeedIndex(String(existingPlayer.speedIndex));
      setMobileNumber(displayPhoneNumberFromE164(existingPlayer.mobile_number || ''));
      setNickname(existingPlayer.nickname || '');
    }
  }, [existingPlayer]);

  const savePlayer = useCallback(
    (showSuccessAlert: boolean): boolean => {
      if (!name.trim()) {
        Alert.alert('Missing Name', 'Please enter a player name.');
        return false;
      }

      const speed = parseFloat(speedIndex);
      if (isNaN(speed)) {
        Alert.alert('Invalid Speed Index', 'Please enter a valid number.');
        return false;
      }

      if (isNew) {
        addPlayer(
          {
            name: name.trim(),
            email: email.trim(),
            speedIndex: speed,
            available: 1,
            nickname: nickname.trim() ?? generateNickname(name.trim()),
            mobile_number: formatPhoneNumberToE164(mobileNumber.trim()),
          },
          null,
        );
        if (showSuccessAlert) {
          Alert.alert('Player Added', `${name} has been added`);
        }
      } else {
        updatePlayer(Number(id), {
          name: name.trim(),
          email: email.trim(),
          speedIndex: speed,
          nickname: nickname.trim(),
          mobile_number: formatPhoneNumberToE164(mobileNumber.trim()),
        });
        if (showSuccessAlert) {
          Alert.alert('Player Updated', `${name} has been updated.`);
        }
      }

      return true;
    },
    [addPlayer, email, id, isNew, mobileNumber, name, nickname, speedIndex, updatePlayer],
  );

  const handleSave = useCallback(() => {
    const didSave = savePlayer(true);
    if (!didSave) {
      return;
    }

    router.back();
  }, [router, savePlayer]);

  const hasChanges = useMemo(() => {
    if (isNew) {
      return [name, email, mobileNumber, nickname, speedIndex].some((value) => value.trim().length > 0);
    }

    if (!existingPlayer) {
      return false;
    }

    const currentName = name.trim();
    const currentEmail = email.trim();
    const currentNickname = nickname.trim();
    const currentMobile = formatPhoneNumberToE164(mobileNumber.trim());
    const currentSpeed = speedIndex.trim().length ? parseFloat(speedIndex) : NaN;

    const originalName = existingPlayer.name.trim();
    const originalEmail = (existingPlayer.email || '').trim();
    const originalNickname = (existingPlayer.nickname || '').trim();
    const originalMobile = formatPhoneNumberToE164((existingPlayer.mobile_number || '').trim());
    const originalSpeed = Number(existingPlayer.speedIndex);

    return (
      currentName !== originalName ||
      currentEmail !== originalEmail ||
      currentNickname !== originalNickname ||
      currentMobile !== originalMobile ||
      currentSpeed !== originalSpeed
    );
  }, [email, existingPlayer, isNew, mobileNumber, name, nickname, speedIndex]);

  const handleNavigateToPlayer = useCallback(
    (targetPlayerId: number) => {
      const navigateToTarget = () => {
        router.setParams({ id: String(targetPlayerId) });
      };

      if (hasChanges) {
        Alert.alert('Unsaved Changes', 'Do you want to save the changes or abandon changes?', [
          {
            text: 'Save the changes',
            onPress: () => {
              const didSave = savePlayer(false);
              if (didSave) {
                navigateToTarget();
              }
            },
          },
          { text: 'Abandon changes', style: 'destructive', onPress: navigateToTarget },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      navigateToTarget();
    },
    [hasChanges, router, savePlayer],
  );

  const handleBackPress = useCallback(() => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'Do you want to save the changes or abandon changes?', [
        { text: 'Save the changes', onPress: handleSave },
        { text: 'Abandon changes', style: 'destructive', onPress: () => router.back() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    router.back();
  }, [hasChanges, router, handleSave]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          gestureEnabled: false,
          headerLeft: () => <StyledHeaderBackButton onPress={handleBackPress} />,
          headerRight: () => (
            <View style={styles.headerButtons}>
              {previousPlayerId !== null && (
                <Pressable
                  onPress={() => {
                    handleNavigateToPlayer(previousPlayerId);
                  }}
                  hitSlop={8}
                >
                  <Entypo name="arrow-bold-up" size={24} color={iconButton} />
                </Pressable>
              )}
              {nextPlayerId !== null && (
                <Pressable
                  onPress={() => {
                    handleNavigateToPlayer(nextPlayerId);
                  }}
                  hitSlop={8}
                >
                  <Entypo name="arrow-bold-down" size={24} color={iconButton} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <ThemedView style={{ flex: 1 }}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>
              {isNew ? 'Add New Player' : 'Edit Player'}
            </ThemedText>
            <ThemedText type="small">Master Player List</ThemedText>

            <ThemedText style={styles.label}>Name</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Player name"
            />

            <ThemedText style={styles.label}>Nickname</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Player nickname"
            />

            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={email}
              autoCorrect={false}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
            />

            <ThemedText style={styles.label}>Mobile Number</ThemedText>
            <View style={styles.mobileRow}>
              <ThemedTextInput
                style={[styles.input, styles.mobileInput]}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                onBlur={() => setMobileNumber(displayPhoneNumberFromE164(mobileNumber))}
                placeholder="Mobile Number including area code"
                keyboardType="phone-pad"
              />
              {!isNew && mobileNumber.trim() !== '' && (
                <View style={styles.mobileButtons}>
                  <Pressable
                    onPress={async () => {
                      const phone = formatPhoneNumberToE164(mobileNumber.trim());
                      const url = `tel:${phone}`;
                      try {
                        const supported = await Linking.canOpenURL(url);
                        if (!supported) {
                          Alert.alert(
                            'Cannot place call',
                            'Your device cannot place calls using this number.',
                          );
                          return;
                        }
                        await Linking.openURL(url);
                      } catch (error) {
                        Alert.alert('Call failed', 'An error occurred while trying to place the call.');
                      }
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="call" size={24} color={iconButton} />
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      const phone = formatPhoneNumberToE164(mobileNumber.trim());
                      const url = `sms:${phone}`;
                      try {
                        const supported = await Linking.canOpenURL(url);
                        if (!supported) {
                          Alert.alert('Cannot send text', 'Your device cannot send texts using this number.');
                          return;
                        }
                        await Linking.openURL(url);
                      } catch (error) {
                        Alert.alert(
                          'Text failed',
                          'An error occurred while trying to open the messaging app.',
                        );
                      }
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="chatbubble" size={24} color={iconButton} />
                  </Pressable>
                </View>
              )}
            </View>

            <ThemedText style={styles.label}>Speed Index (1-Fast/3-Med/5-Slow)</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={speedIndex}
              onChangeText={setSpeedIndex}
              placeholder="Speed index"
              keyboardType="numeric"
            />

            <ThemedView>
              <ThemedView
                style={{
                  marginTop: 10,
                  borderColor: iconButton,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title={isNew ? 'Add Player' : 'Save Changes'} onPress={handleSave} />
              </ThemedView>
              <ThemedView
                style={{
                  marginTop: 10,
                  borderColor: textDim,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title="Cancel" color={textDim} onPress={() => router.back()} />
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </KeyboardAwareScrollView>
      </ThemedView>
      {Platform.OS === 'ios' && <KeyboardToolbar offset={{ opened: iosKeyboardToolbarOffset }} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  title: {
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mobileInput: {
    flex: 1,
    marginTop: 0,
  },
  mobileButtons: {
    flexDirection: 'row',
    gap: 20,
    marginLeft: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
});
