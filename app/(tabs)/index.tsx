import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { addPlayer, createRound, deletePlayerById, getActiveRound, getPlayersForRound, getRoundSummaries, initDb, PlayerWithActive, setActiveRound, setPlayerActiveForRound, setRoundStatus } from '@/lib/players';

export default function HomeScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerWithActive[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<import('@/lib/players').RoundSummary[] | import('@/lib/players').Round[]>([]);

  useEffect(() => {
    let mounted = true;
    async function setup() {
      try {
        await initDb();
        // create a new pending round to act as "current round"
        // load rounds and active round
  const r = await getRoundSummaries();
        const active = await getActiveRound();
  if (mounted) setRounds(r as any);
        if (active == null) {
          // create a new pending round if none
          const roundId = await createRound('pending');
          await setActiveRound(roundId);
          if (mounted) setCurrentRoundId(roundId ?? null);
          const p = await getPlayersForRound(roundId ?? null);
          if (mounted) setPlayers(p);
        } else {
          if (mounted) setCurrentRoundId(active);
          const p = await getPlayersForRound(active ?? null);
          if (mounted) setPlayers(p);
        }
      } catch (e) {
        console.warn('DB init/fetch failed', e);
      }
    }
    setup();
    return () => {
      mounted = false;
    };
  }, []);

  // reload when returning to this screen (e.g., after navigating back from add/edit)
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [currentRoundId])
  );

  const seed = async () => {
    try {
      await addPlayer({ name: 'Garry', speedIndex: 1 });
      await addPlayer({ name: 'Carl', speedIndex: 1 });
      await addPlayer({ name: 'Larry L', speedIndex: 2 });
      await addPlayer({ name: 'Dave', speedIndex: 3 });
      await addPlayer({ name: 'Huff', speedIndex: 4 });
      await addPlayer({ name: 'Jack', speedIndex: 5 });
      const p = await getPlayersForRound(currentRoundId);
      setPlayers(p);
    } catch (e) {
      console.warn('Seed failed', e);
    }
  };

  const refreshRounds = async () => {
    const r = await getRoundSummaries();
    setRounds(r as any);
  };

  const loadData = async (roundId?: number | null) => {
    const rId = typeof roundId !== 'undefined' ? roundId : currentRoundId;
    const p = await getPlayersForRound(rId ?? null);
    setPlayers(p);
    const summaries = await getRoundSummaries();
    setRounds(summaries as any);
  };

  const createAndSelectRound = async () => {
    // Ask whether to copy active players from last round
    Alert.alert('New round', 'Create an empty round or copy active players from the most recent round?', [
      { text: 'Empty', onPress: async () => {
        const id = await createRound('pending');
        await setActiveRound(id);
        setCurrentRoundId(id ?? null);
        await refreshRounds();
        const p = await getPlayersForRound(id ?? null);
        setPlayers(p);
      }},
      { text: 'Copy from last', onPress: async () => {
        const id = await createRound('pending');
        const last = (rounds && (rounds as any)[0]) ? (rounds as any)[0].id : null;
        if (last != null) {
          // import here
          try {
            // import helper lazily to avoid circular issues
            const mod = await import('@/lib/players');
            if (mod.copyActivePlayersToRound) {
              await mod.copyActivePlayersToRound(last, id);
            }
          } catch (e) {
            console.warn('Copy failed', e);
          }
        }
        await setActiveRound(id);
        setCurrentRoundId(id ?? null);
        await refreshRounds();
        const p = await getPlayersForRound(id ?? null);
        setPlayers(p);
      }},
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const selectRound = async (id: number) => {
    await setActiveRound(id);
    setCurrentRoundId(id);
    const p = await getPlayersForRound(id);
    setPlayers(p);
  };

  const toggleActive = async (player: PlayerWithActive) => {
    try {
      if (currentRoundId == null) return;
      await setPlayerActiveForRound(currentRoundId, player.id, !player.active);
      const p = await getPlayersForRound(currentRoundId);
      setPlayers(p);
      await refreshRounds();
    } catch (e) {
      console.warn('Toggle failed', e);
    }
  };

  // navigation router available for edit/add player screens
  // startEdit will navigate to the edit screen
  const startEdit = (player: PlayerWithActive) => {
    router.push(`/player/${player.id}`);
  };

  // Add player navigation
  const addNewPlayer = () => {
    router.push('/player/new');
  };

  const confirmDelete = (player: PlayerWithActive) => {
    Alert.alert('Delete player', `Delete ${player.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(player) },
    ]);
  };

  const handleDelete = async (player: PlayerWithActive) => {
    try {
      if (!player.id) return;
      await deletePlayerById(player.id);
      const p = await getPlayersForRound(currentRoundId);
      setPlayers(p);
    } catch (e) {
      console.warn('Delete failed', e);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
      </ThemedView>

      {/* Round picker */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '600' }}>Rounds</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Add Player" onPress={addNewPlayer} />
            <Button title="New Round" onPress={createAndSelectRound} />
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {rounds.map((r: any) => (
              <Pressable
                key={r.id}
                onPress={() => selectRound(r.id)}
                onLongPress={() => {
                  Alert.alert('Round actions', `Round ${r.id}`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Mark completed', onPress: async () => { await setRoundStatus(r.id, 'completed'); await refreshRounds(); } },
                    { text: 'Mark canceled', onPress: async () => { await setRoundStatus(r.id, 'canceled'); await refreshRounds(); } },
                  ]);
                }}
                style={{ padding: 8, marginRight: 8, borderRadius: 6, backgroundColor: currentRoundId === r.id ? '#0066cc' : '#eee' }}
              >
                <Text style={{ color: currentRoundId === r.id ? 'white' : '#222' }}>{`${r.id} • ${new Date(r.date).toLocaleString()} (${r.status}) — ${r.activeCount ?? 0} active`}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.stepContainer}>
        <Button title="Seed sample players" onPress={seed} />
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <Text>{`Players: ${players.length} — Active: ${players.filter(p => p.active).length}`}</Text>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ThemedView style={{ padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <>
              <ThemedText>{item.name} — {item.speedIndex}</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Switch value={!!item.active} onValueChange={(_val) => { void toggleActive(item); }} />
                <Button title="Edit" onPress={() => startEdit(item)} />
                <Button title="Delete" color="#d00" onPress={() => confirmDelete(item)} />
              </View>
            </>
          </ThemedView>
        )}
      />
      {/* navigation to player add/edit screen */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
