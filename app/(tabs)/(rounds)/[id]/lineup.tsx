import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { formatDate } from '@/lib/formatters';

type Params = {
  id: string; // numeric id
};

export default function LineupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const roundId = Number(id);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { players, rounds, roundPlayers, fetchPlayers, fetchRounds, fetchRoundPlayers, setRoundPlayers } =
    useDbStore();

  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  // Load data on mount
  useEffect(() => {
    fetchPlayers();
    fetchRounds();
    fetchRoundPlayers();
  }, []);

  // refresh when data or round changes, update selectedPlayers
  useEffect(() => {
    const activePlayers = roundPlayers
      .filter((rp) => rp.round_id === roundId && rp.active === 1)
      .map((rp) => rp.player_id);
    setSelectedPlayers(activePlayers);
  }, [roundId, roundPlayers]);

  const round = rounds.find((r) => r.id === roundId);

  // Debounced DB save helper - we debounce calls by 250 ms to prevent SQLite from being hammered
  // if the user quickly taps multiple players in a row.
  const persistSelection = (newSelection: number[]) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setRoundPlayers(roundId, newSelection);
    }, 250);
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
    const allIds = players.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPlayers.includes(id));
    const newSelection = allSelected ? [] : allIds;
    setSelectedPlayers(newSelection);
    persistSelection(newSelection);
  };

  if (!round) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ThemedText>Loading round...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: true, title: 'Line-up' }} />
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <ThemedText style={{ fontWeight: '600' }}>{`${round?.course} (${formatDate(
            round?.date,
          )})`}</ThemedText>
        </View>
      </View>

      {players.length === 0 ? (
        <View style={styles.stepContainer}>
          <ThemedText>No players available. Go to Players Tab to add players to get started.</ThemedText>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <ThemedText>{`Players: ${players.length} — Active: ${selectedPlayers.length}`}</ThemedText>
          </View>

          <FlatList
            data={players}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={() => {
              const allSelected = players.length > 0 && players.every((p) => selectedPlayers.includes(p.id));

              return (
                <ThemedView
                  style={{
                    padding: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderColor: '#ddd',
                    gap: 30,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={allSelected}
                      onValueChange={toggleAllPlayers}
                      disabled={players.length === 0}
                    />
                  </View>
                  <ThemedText style={{ fontWeight: '700' }}>Player</ThemedText>
                </ThemedView>
              );
            }}
            renderItem={({ item }) => (
              <ThemedView
                style={{
                  padding: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={selectedPlayers.includes(item.id)}
                      onValueChange={(_val) => {
                        void togglePlayer(item.id);
                      }}
                    />
                    <ThemedText style={{ marginLeft: 30 }}>{item.name}</ThemedText>
                  </View>
                </>
              </ThemedView>
            )}
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    padding: 10,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
