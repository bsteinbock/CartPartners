import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import ThemedButton from '@/components/ui/ThemedButton';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SMS from 'expo-sms';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

export default function SetGroupCoordinatorScreen() {
  const router = useRouter();
  const { all_players } = useDbStore();
  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [pickedPlayer, setPickedPlayer] = useState<OptionEntry | null>(null);

  const { bodyText, mobileNumbers } = useLocalSearchParams<{ bodyText: string; mobileNumbers: string }>();
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');

  useEffect(() => {
    const availableOptions = all_players.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setPlayerOptions([]);
    } else {
      setPlayerOptions(availableOptions);
    }
  }, [all_players]);

  const sendTextMessage = async (addresses: string | string[], message: string) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS not available on this device');
      return;
    }

    await SMS.sendSMSAsync(
      addresses, // recipient(s)
      message,
    );
  };

  // get mobile numbers array
  const mobilePhoneNumbers: string[] = useMemo(() => {
    return mobileNumbers ? JSON.parse(mobileNumbers) : [];
  }, [mobileNumbers]);

  const handlePlayerSelect = (option: OptionEntry) => {
    setPickedPlayer(option);
    setIsPlayerPickerVisible(false);
  };

  const handleSaveMyId = useCallback(async () => {
    if (pickedPlayer === null) return;

    const player = all_players.find((p) => p.id === pickedPlayer.value);
    if (player) {
      await SecureStore.setItemAsync('cartPartnerGroupCoordinatorId', player.id.toString());

      // don't include my number in the list for texting
      if (player.mobile_number) {
        const index = mobilePhoneNumbers.indexOf(player.mobile_number);
        if (index > -1) {
          mobilePhoneNumbers.splice(index, 1);
        }
        await sendTextMessage(mobilePhoneNumbers, bodyText);
      } else {
        Alert.alert(
          'No Mobile Number',
          'The selected coordinator does not have a mobile number defined So we cannot send text message.',
        );
      }

      // navigate back to groups index with my number
      router.back();
    }
  }, [all_players, bodyText, mobilePhoneNumbers, router, pickedPlayer]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Set Group Coordinator
      </ThemedText>
      <ThemedText style={styles.title}>
        This info is used so your number is excluded when sending text messages. Since you don&apos;t want to
        text yourself.
      </ThemedText>

      <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Group Coordinator</ThemedText>
      <OptionPickerItem
        containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
        optionLabel={pickedPlayer?.label}
        placeholder="Select Group Coordinator"
        onPickerButtonPress={() => setIsPlayerPickerVisible(true)}
      />
      <ThemedView
        style={{
          margin: 10,
          marginTop: 20,
          borderColor: myNumber.length < 10 ? disabledColor : iconButton,
          borderWidth: 1,
          borderRadius: 6,
        }}
      >
        <ThemedButton title="Finish" onPress={handleSaveMyId} disabled={!pickedPlayer} />
      </ThemedView>
      {playerOptions && isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title="Select Yourself as Group Coordinator"
          modalHeight="70%"
          onClose={() => setIsPlayerPickerVisible(false)}
        >
          <OptionList options={playerOptions} onSelect={handlePlayerSelect} />
        </BottomSheetContainer>
      )}
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 12,
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
});
