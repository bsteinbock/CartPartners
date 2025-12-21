import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';

export default function SettingsScreen() {
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const [useEmailCC, setUseEmailCC] = useState<boolean>(false);
  const [excludeCoordinatorFromEmail, setExcludeCoordinatorFromEmail] = useState<boolean>(false);
  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [pickedPlayer, setPickedPlayer] = useState<OptionEntry | null>(null);
  const { all_players } = useDbStore();

  // Load settings on mount and when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const storedUseCC = await SecureStore.getItemAsync('cartPartnerUseEmailCC');
        setUseEmailCC(storedUseCC === 'true');

        const storedExcludeCoordinator = await SecureStore.getItemAsync('cartPartnerExcludeCoordinatorFromEmail');
        setExcludeCoordinatorFromEmail(storedExcludeCoordinator === 'true');

        const coordinatorIdString = await SecureStore.getItemAsync('cartPartnerGroupCoordinatorId');
        if (coordinatorIdString) {
          const coordinatorId = parseInt(coordinatorIdString, 10);
          const coordinator = all_players.find((p) => p.id === coordinatorId);
          if (coordinator) {
            setPickedPlayer({ label: coordinator.name, value: coordinator.id });
          }
        }
      })();
    }, [all_players]),
  );

  useEffect(() => {
    const availableOptions = all_players.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    setPlayerOptions(availableOptions);
  }, [all_players]);

  const handleToggleEmailCC = async (value: boolean) => {
    setUseEmailCC(value);
    await SecureStore.setItemAsync('cartPartnerUseEmailCC', value.toString());
  };

  const handleToggleExcludeCoordinator = async (value: boolean) => {
    setExcludeCoordinatorFromEmail(value);
    await SecureStore.setItemAsync('cartPartnerExcludeCoordinatorFromEmail', value.toString());
  };

  const handlePlayerSelect = async (option: OptionEntry) => {
    setPickedPlayer(option);
    setIsPlayerPickerVisible(false);
    await SecureStore.setItemAsync('cartPartnerGroupCoordinatorId', option.value.toString());
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Email Settings
        </ThemedText>

        <ThemedView style={styles.settingRow}>
          <ThemedView style={styles.settingLabelContainer}>
            <ThemedText style={styles.settingLabel}>Use CC for Multiple Recipients</ThemedText>
          </ThemedView>
          <Switch
            trackColor={{ true: switchTrackColor }}
            value={useEmailCC}
            onValueChange={handleToggleEmailCC}
          />
        </ThemedView>
        <ThemedText type="small" style={styles.settingDescription}>
          When enabled, email notifications will place the first recipient in the &quot;To&quot; field and
          remaining recipients in the &quot;CC&quot; field. This supports email clients like Yahoo Mail that
          only allow a single &quot;To&quot; recipient.
        </ThemedText>

        <ThemedView style={[styles.settingRow, { marginTop: 20 }]}>
          <ThemedView style={styles.settingLabelContainer}>
            <ThemedText style={styles.settingLabel}>Exclude Group Coordinator from Email Recipients</ThemedText>
          </ThemedView>
          <Switch
            trackColor={{ true: switchTrackColor }}
            value={excludeCoordinatorFromEmail}
            onValueChange={handleToggleExcludeCoordinator}
          />
        </ThemedView>
        <ThemedText type="small" style={styles.settingDescription}>
          When enabled, the group coordinator will be excluded from email recipients when sending group
          notifications.
        </ThemedText>

        <ThemedText type="subtitle" style={[styles.sectionTitle, styles.coordinatorSection]}>
          Group Coordinator
        </ThemedText>

        <ThemedText style={styles.settingDescription}>
          Select the group coordinator. This person will be excluded from text message recipients (since they
          don&apos;t need to text themselves). Use the &quot;Exclude Group Coordinator from Email
          Recipients&quot; setting above to also exclude them from emails.
        </ThemedText>

        <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Group Coordinator</ThemedText>
        <OptionPickerItem
          containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
          optionLabel={pickedPlayer?.label}
          placeholder="Select Group Coordinator"
          onPickerButtonPress={() => setIsPlayerPickerVisible(true)}
        />
      </ThemedView>

      {playerOptions && isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title="Select Group Coordinator"
          modalHeight="70%"
          onClose={() => setIsPlayerPickerVisible(false)}
        >
          <OptionList options={playerOptions} onSelect={handlePlayerSelect} />
        </BottomSheetContainer>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'left',
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 22,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 15,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: '500',
    marginBottom: 10,
  },
  settingDescription: {
    paddingLeft: 10,
    lineHeight: 16,
  },
  coordinatorSection: {
    marginTop: 24,
  },
});
