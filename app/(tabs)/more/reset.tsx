import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import ThemedButton from '@/components/ui/ThemedButton';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

export default function ResetScreen() {
  const { leagues, resetAppData, clearRoundsForLeague, clearLeagueData } = useDbStore();
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');

  const [leagueOptions, setLeagueOptions] = useState<OptionEntry[]>([]);
  const [pickedLeagueForRounds, setPickedLeagueForRounds] = useState<OptionEntry | undefined>(undefined);
  const [pickedLeagueForClear, setPickedLeagueForClear] = useState<OptionEntry | undefined>(undefined);
  const [isRoundsLeaguePickerVisible, setIsRoundsLeaguePickerVisible] = useState(false);
  const [isClearLeaguePickerVisible, setIsClearLeaguePickerVisible] = useState(false);

  useEffect(() => {
    const options = leagues.map((league) => ({ label: league.name, value: league.id }));
    setLeagueOptions(options);

    if (options.length === 0) {
      setPickedLeagueForRounds(undefined);
      setPickedLeagueForClear(undefined);
      return;
    }

    setPickedLeagueForRounds((prev) => {
      if (prev && options.some((o) => o.value === prev.value)) return prev;
      return options[0];
    });

    setPickedLeagueForClear((prev) => {
      if (prev && options.some((o) => o.value === prev.value)) return prev;
      return options[0];
    });
  }, [leagues]);

  const confirmResetApp = () => {
    Alert.alert(
      'Reset App',
      'This will delete all data in the app, including players, leagues, rounds, groups, and settings data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'All data will be permanently removed. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete All Data',
                  style: 'destructive',
                  onPress: () => resetAppData(),
                },
              ],
              { cancelable: true },
            );
          },
        },
      ],
      { cancelable: true },
    );
  };

  const confirmClearRounds = () => {
    if (!pickedLeagueForRounds?.value) return;

    Alert.alert(
      'Clear The Rounds',
      `Delete all rounds, round players, and groups for ${pickedLeagueForRounds.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Rounds',
          style: 'destructive',
          onPress: () => clearRoundsForLeague(Number(pickedLeagueForRounds.value)),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmClearLeague = () => {
    if (!pickedLeagueForClear?.value) return;

    Alert.alert(
      'Clear a League',
      `Delete league data for ${pickedLeagueForClear.label}, including its rounds and league-player assignments?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear League',
          style: 'destructive',
          onPress: () => clearLeagueData(Number(pickedLeagueForClear.value)),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title">Reset/Clear Data</ThemedText>
        <ThemedText type="small">
          Before running the commands below, it is recommended that you back up your data. See the
          "Backup/Restore" section in the menu available by selecting the button at top left of the screen.
        </ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Clear a League</ThemedText>
          <ThemedText style={styles.description}>Deletes all data for the selected league.</ThemedText>
          <OptionPickerItem
            containerStyle={{ backgroundColor: backgroundColor, height: 44 }}
            optionLabel={pickedLeagueForClear?.label}
            placeholder="Select League"
            onPickerButtonPress={() => setIsClearLeaguePickerVisible(true)}
          />
          <ThemedView
            style={{
              marginTop: 8,
              borderColor: pickedLeagueForClear ? iconButton : disabledColor,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton
              title="Clear a League"
              onPress={confirmClearLeague}
              disabled={!pickedLeagueForClear}
            />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Reset App</ThemedText>
          <ThemedText style={styles.description}>
            Deletes all data for all leagues including players, rounds, groups, and settings, and resets the
            app to a clean starting point.
          </ThemedText>
          <ThemedView
            style={{
              marginTop: 8,
              borderColor: iconButton,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton title="Reset App" onPress={confirmResetApp} />
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {isClearLeaguePickerVisible && (
        <BottomSheetContainer
          isVisible={isClearLeaguePickerVisible}
          title="Select League"
          modalHeight="70%"
          onClose={() => setIsClearLeaguePickerVisible(false)}
        >
          <OptionList
            options={leagueOptions}
            selectedOption={pickedLeagueForClear}
            onSelect={(option) => {
              setPickedLeagueForClear(option);
              setIsClearLeaguePickerVisible(false);
            }}
          />
        </BottomSheetContainer>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
    marginTop: 10,
  },
  description: {
    opacity: 0.85,
  },
});
