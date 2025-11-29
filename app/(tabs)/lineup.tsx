import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import MultiSelectOptionList from '@/components/ui/MultiSelectOptionList';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDate } from '@/lib/formatters';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { memo, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Memoized player item component for better FlatList performance
const PlayerItem = memo<{
  player: Player;
  isSelected: boolean;
  onToggle: (playerId: number) => void;
  switchTrackColor: string;
}>(function PlayerItem({ player, isSelected, onToggle, switchTrackColor }) {
  const handleToggle = () => {
    onToggle(player.id);
  };

  return (
    <ThemedView
      style={{
        padding: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Switch trackColor={{ true: switchTrackColor }} value={isSelected} onValueChange={handleToggle} />
        <ThemedText style={{ marginLeft: 30 }}>{player.name}</ThemedText>
      </ThemedView>
    </ThemedView>
  );
});

export default function LineupScreen() {
  const {
    rounds,
    league_players,
    all_players,
    roundPlayers,
    setRoundPlayers,
    setCurrentRoundId,
    currentRoundId,
    leagues,
    addPlayersToLeague,
    currentLeagueId,
  } = useDbStore();
  const [isRoundPickerVisible, setIsRoundPickerVisible] = useState<boolean>(false);
  const [pickedRound, setPickedRound] = useState<OptionEntry | undefined>(undefined);
  const [roundOptions, setRoundOptions] = useState<OptionEntry[]>([]);
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const errorText = useThemeColor({ light: undefined, dark: undefined }, 'errorText');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const league = leagues.find((l) => l.id === currentLeagueId);

  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [selectedPlayerOptions, setSelectedPlayerOptions] = useState<OptionEntry[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Create a set of players using all_players that are specified by player_id in roundPlayers for the current round
    // or are marked as available in league_players
    const availableSet = new Set<number>();
    roundPlayers
      .filter((rp) => rp.round_id === currentRoundId)
      .forEach((rp) => availableSet.add(rp.player_id));
    league_players.filter((p) => p.available).forEach((p) => availableSet.add(p.id));
    const availableList = all_players.filter((p) => availableSet.has(p.id));
    setAvailablePlayers(availableList);
  }, [league_players, all_players, roundPlayers, currentRoundId]);

  const availablePlayersToAdd = all_players
    .filter((p) => p.available)
    .filter((p) => !availablePlayers.find((lp) => lp.id === p.id));

  useEffect(() => {
    const activePlayers = roundPlayers
      .filter((rp) => rp.round_id === currentRoundId)
      .map((rp) => rp.player_id);
    setSelectedPlayers(activePlayers);
  }, [currentRoundId, roundPlayers]);

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
    const availableOptions = rounds.map((r) => ({
      label: `${r.course} (${formatDate(r.date)})`,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setRoundOptions([]);
    } else {
      const latestRound = availableOptions.find((o) => o.value === currentRoundId) ?? availableOptions[0];
      setPickedRound(latestRound);
      setRoundOptions(availableOptions);
    }
  }, [rounds, currentRoundId]);

  useEffect(() => {
    const latestRound = roundOptions.find((o) => o.value === currentRoundId) ?? roundOptions[0];
    setPickedRound(latestRound);
  }, [currentRoundId, roundOptions]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleRoundOptionChange = (option: OptionEntry) => {
    setPickedRound(option);
    setCurrentRoundId(option.value);
    setIsRoundPickerVisible(false);
  };

  // Debounced DB save helper - we debounce calls by 250 ms to prevent SQLite from being hammered
  // if the user quickly taps multiple players in a row.
  const persistSelection = (newSelection: number[]) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (currentRoundId) setRoundPlayers(currentRoundId, newSelection);
    }, 100);
  };

  // Toggle a player's selection
  const togglePlayer = (playerId: number) => {
    setSelectedPlayers((prev) => {
      const newSelection = prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId];
      persistSelection(newSelection);
      return newSelection;
    });
  };

  // Select or clear all players
  const toggleAllPlayers = () => {
    const allIds = availablePlayers.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPlayers.includes(id));
    const newSelection = allSelected ? [] : allIds;
    setSelectedPlayers(newSelection);
    persistSelection(newSelection);
  };

  const allSelected =
    league_players.length > 0 && availablePlayers.every((p) => selectedPlayers.includes(p.id));
  const playerLabel = `Player (${selectedPlayers.length} of ${availablePlayers.length} Selected)`;

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
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedView>
              <ThemedText type="title">Player Lineup</ThemedText>
              <ThemedText type="small">{league?.name}</ThemedText>
            </ThemedView>
            {availablePlayersToAdd.length > 0 && (
              <Pressable onPress={() => setIsPlayerPickerVisible(true)}>
                <Ionicons name="person-add-sharp" size={28} color={iconColor} />
              </Pressable>
            )}
          </ThemedView>

          {rounds.length === 0 ? (
            <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
              At least one Rounds must be defined before a lineup of players can be set.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Round</ThemedText>
              <OptionPickerItem
                containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
                optionLabel={pickedRound?.label}
                placeholder="Select Round"
                onPickerButtonPress={() => setIsRoundPickerVisible(true)}
              />
            </>
          )}
        </ThemedView>

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
                padding: 8,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderColor: '#ddd',
                marginLeft: 8,
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
              <ThemedText style={{ fontWeight: '700' }}>{playerLabel}</ThemedText>
            </ThemedView>

            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={availablePlayers}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <PlayerItem
                  player={item}
                  isSelected={selectedPlayers.includes(item.id)}
                  onToggle={togglePlayer}
                  switchTrackColor={switchTrackColor}
                />
              )}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
            />
          </>
        )}
        {roundOptions.length > 0 && isRoundPickerVisible && (
          <BottomSheetContainer
            isVisible={isRoundPickerVisible}
            title="Select Round"
            modalHeight="70%"
            onClose={() => setIsRoundPickerVisible(false)}
          >
            <OptionList
              options={roundOptions}
              onSelect={(option) => handleRoundOptionChange(option)}
              selectedOption={pickedRound}
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
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
