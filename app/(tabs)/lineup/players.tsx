import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import MultiSelectOptionList from '@/components/ui/MultiSelectOptionList';
import { OptionEntry } from '@/components/ui/OptionList';
import SwipeableLeaguePlayerItem from '@/components/ui/SwipeableLeaguePlayer';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164 } from '@/lib/cart-utils';
import { FontAwesome5 } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

export default function PlayersScreen() {
  const router = useRouter();
  const { league_players, addPlayersToLeague, currentLeagueId, leagues, all_players } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const league = leagues.find((l) => l.id === currentLeagueId);

  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [selectedPlayerOptions, setSelectedPlayerOptions] = useState<OptionEntry[]>([]);

  const availablePlayers = useMemo(
    () => all_players.filter((p) => p.available).filter((p) => !league_players.find((lp) => lp.id === p.id)),
    [all_players, league_players],
  );

  useEffect(() => {
    const availableOptions = availablePlayers.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setPlayerOptions([]);
    } else {
      setPlayerOptions(availableOptions);
    }
  }, [availablePlayers]);

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/lineup/${id}`);
  };

  const addNewPlayer = () => {
    router.push({ pathname: `/lineup/[id]`, params: { id: 'new' } });
  };

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

  const handlePlayerOptionChange = useCallback((option: OptionEntry) => {
    setSelectedPlayerOptions((prev) => {
      const exists = prev.find((o) => o.value === option.value);
      if (exists) {
        return prev.filter((o) => o.value !== option.value);
      } else {
        return [...prev, option];
      }
    });
  }, []);

  return (
    <>
      <ThemedView style={{ flex: 1 }}>
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
            <ThemedText type="small">{league?.name}</ThemedText>
          </ThemedView>
          <View style={{ flexDirection: 'row', gap: 30, alignItems: 'center', paddingRight: 10 }}>
            {league_players.length > 0 && (
              <Pressable onPress={exportToCSV}>
                <MaterialCommunityIcons name="application-export" size={28} color={iconColor} />
              </Pressable>
            )}
            {availablePlayers.length > 0 && (
              <Pressable onPress={() => setIsPlayerPickerVisible(true)}>
                <FontAwesome5 name="plus-circle" size={28} color={iconColor} />
              </Pressable>
            )}
          </View>
        </ThemedView>
        {league_players.length === 0 && (
          <ThemedView style={{ padding: 12 }}>
            <ThemedText style={{ marginTop: 12 }}>
              No players defined. You can add players manually using the '+' icon.
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
      {playerOptions && isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title="Select Player"
          modalHeight="50%"
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

const styles = StyleSheet.create({
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
