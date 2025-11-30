import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import MultiSelectOptionList from '@/components/ui/MultiSelectOptionList';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import SwipeableLeaguePlayerItem from '@/components/ui/SwipeableLeaguePlayer';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164 } from '@/lib/cart-utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

export default function PlayersScreen() {
  const { league_players, setCurrentLeagueId, currentLeagueId, leagues, all_players, addPlayersToLeague } =
    useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const league = leagues.find((l) => l.id === currentLeagueId);

  const [isLeaguePickerVisible, setIsLeaguePickerVisible] = useState<boolean>(false);
  const [leagueOptions, setLeagueOptions] = useState<OptionEntry[]>([]);
  const [pickedOption, setPickedOption] = useState<OptionEntry | undefined>(undefined);

  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [selectedPlayerOptions, setSelectedPlayerOptions] = useState<OptionEntry[]>([]);

  const availablePlayersToAdd = useMemo(
    () => all_players.filter((p) => p.available).filter((p) => !league_players.find((lp) => lp.id === p.id)),
    [all_players, league_players],
  );

  useEffect(() => {
    const availableOptions = availablePlayersToAdd.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setPlayerOptions([]);
    } else {
      setPlayerOptions(availableOptions);
    }
  }, [availablePlayersToAdd]);

  useEffect(() => {
    const availableOptions = leagues.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setLeagueOptions([]);
    } else {
      setLeagueOptions(availableOptions);
    }
  }, [leagues]);

  useEffect(() => {
    if (currentLeagueId && leagueOptions.length > 0) {
      const found = leagueOptions.find((o) => o.value === currentLeagueId);
      setPickedOption(found);
    } else {
      setPickedOption(undefined);
    }
  }, [currentLeagueId, leagueOptions]);

  const exportToCSV = async () => {
    if (!league_players || league_players.length === 0) {
      Alert.alert('No data', 'There are no players to export.');
      return;
    }

    try {
      const header = ['Name', 'Nickname', 'Speed Index', 'Email', 'Mobile Number', 'Available'];
      const rows = league_players.map((p) => [
        `"${p.name}"`,
        `"${p.nickname || ''}"`,
        p.speedIndex,
        `"${p.email ?? ''}"`,
        `"${displayPhoneNumberFromE164(p.mobile_number) ?? ''}"`,
        p.available ? 'Yes' : 'No',
      ]);

      const csvString = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const fileName = league ? `${league.name}_players.csv` : 'cartpartners-league_players.csv';
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(csvString);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'This device does not support sharing files.');
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Players CSV',
      });
    } catch (err) {
      console.error('Error exporting CSV', err);
      Alert.alert('Error', 'Failed to export league_players.');
    }
  };

  const handleLeagueOptionChange = (option: OptionEntry) => {
    const leagueToSetActive = leagues.find((p) => p.id === option.value);
    if (leagueToSetActive) {
      setCurrentLeagueId(leagueToSetActive.id);
      setIsLeaguePickerVisible(false);
    }
  };

  const handlePlayerOptionChange = (option: OptionEntry) => {
    setSelectedPlayerOptions((prev) => {
      const exists = prev.find((o) => o.value === option.value);
      if (exists) {
        return prev.filter((o) => o.value !== option.value);
      } else {
        return [...prev, option];
      }
    });
  };

  return (
    <>
      <ThemedView style={{ flex: 1 }}>
        <ThemedView
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            marginTop: 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: borderColor,
          }}
        >
          <OptionPickerItem
            optionLabel={pickedOption ? pickedOption.label : 'Unknown League'}
            placeholder="Select League / Outing"
            onPickerButtonPress={() => setIsLeaguePickerVisible(true)}
          />
        </ThemedView>

        <ThemedView
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 10,
            borderBottomWidth: 1,
            borderBottomColor: useThemeColor({ light: undefined, dark: undefined }, 'border'),
          }}
        >
          <ThemedView>
            <ThemedText type="title">Players</ThemedText>
          </ThemedView>
          <View style={{ flexDirection: 'row', gap: 30, alignItems: 'center', paddingRight: 10 }}>
            {league_players.length > 0 && (
              <Pressable onPress={exportToCSV}>
                <MaterialCommunityIcons name="application-export" size={28} color={iconColor} />
              </Pressable>
            )}
            {availablePlayersToAdd.length > 0 && (
              <Pressable onPress={() => setIsPlayerPickerVisible(true)}>
                <Ionicons name="person-add-sharp" size={28} color={iconColor} />
              </Pressable>
            )}
          </View>
        </ThemedView>
        {league_players.length === 0 && (
          <ThemedView style={{ padding: 12 }}>
            <ThemedText style={{ marginTop: 12 }}>
              No players defined. You can add players manually using the &apos;+&apos; icon.
            </ThemedText>
          </ThemedView>
        )}
        {league_players.length > 0 && (
          <FlatList
            data={league_players}
            keyExtractor={(item, i) => String(item.id ?? i)}
            renderItem={({ item }) => <SwipeableLeaguePlayerItem player={item} />}
          />
        )}
      </ThemedView>
      {leagueOptions && isLeaguePickerVisible && (
        <BottomSheetContainer
          isVisible={isLeaguePickerVisible}
          title="Select League / Outing"
          modalHeight="50%"
          onClose={() => setIsLeaguePickerVisible(false)}
        >
          <OptionList
            options={leagueOptions}
            selectedOption={pickedOption}
            onSelect={(option) => handleLeagueOptionChange(option)}
          />
        </BottomSheetContainer>
      )}
      {playerOptions && isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title="Select Players"
          modalHeight="70%"
          okLabel="Add"
          okDisabled={selectedPlayerOptions.length === 0}
          onOK={() => {
            const playersToAdd = selectedPlayerOptions
              .map((option) => option.value ?? null)
              .filter((v): v is number => v !== null);
            setIsPlayerPickerVisible(false);
            addPlayersToLeague(playersToAdd, currentLeagueId!);
            setSelectedPlayerOptions([]);
          }}
          onClose={() => {
            setIsPlayerPickerVisible(false);
          }}
        >
          <MultiSelectOptionList
            options={playerOptions}
            selectedOptions={selectedPlayerOptions}
            onSelect={(option) => handlePlayerOptionChange(option)}
          />
        </BottomSheetContainer>
      )}
    </>
  );
}
