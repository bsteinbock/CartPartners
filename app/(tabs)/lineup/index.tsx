import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDate } from '@/lib/formatters';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LineupScreen() {
  const {
    rounds,
    league_players,
    roundPlayers,
    setRoundPlayers,
    setCurrentRoundId,
    currentRoundId,
    leagues,
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
  const router = useRouter();
  const league = leagues.find((l) => l.id === currentLeagueId);

  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);

  useEffect(() => {
    setAvailablePlayers(league_players.filter((p) => p.available));
  }, [players]);

  useEffect(() => {
    const activePlayers = roundPlayers
      .filter((rp) => rp.round_id === currentRoundId)
      .map((rp) => rp.player_id);
    setSelectedPlayers(activePlayers);
  }, [currentRoundId, roundPlayers]);

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
  }, [rounds]);

  useEffect(() => {
    const latestRound = roundOptions.find((o) => o.value === currentRoundId) ?? roundOptions[0];
    setPickedRound(latestRound);
  }, [currentRoundId, roundOptions]);

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
    const allIds = league_players.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPlayers.includes(id));
    const newSelection = allSelected ? [] : allIds;
    setSelectedPlayers(newSelection);
    persistSelection(newSelection);
  };

  const allSelected =
    league_players.length > 0 && league_players.every((p) => selectedPlayers.includes(p.id));
  const playerLabel = `Player (${selectedPlayers.length} of ${league_players.length} Selected)`;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedView>
              <ThemedText type="title">Player Lineup</ThemedText>
              <ThemedText type="small">{league?.name}</ThemedText>
            </ThemedView>
            <Pressable
              onPress={() => {
                router.push('/(tabs)/lineup/players');
              }}
            >
              <Ionicons name="person" size={28} color={iconColor} />
            </Pressable>
          </ThemedView>

          {rounds.length === 0 ? (
            <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
              At least one Rounds must be defined before a lineup of players can be set.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Select Round</ThemedText>
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
                      value={selectedPlayers.includes(item.id)}
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
