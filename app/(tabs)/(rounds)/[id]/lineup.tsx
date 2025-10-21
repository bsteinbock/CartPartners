import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  addPlayer,
  getPlayersForRound,
  getRoundById,
  PlayerWithActive,
  Round,
  setPlayerActiveForRound,
} from '@/lib/db-helper';
import { formatDate } from '@/lib/formatters';

type Params = {
  id: string; // 'new' or numeric id
};

export default function LineupScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerWithActive[]>([]);
  const [round, setRound] = useState<Round>();
  const { id } = useLocalSearchParams() as Params;

  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        const numericId = Number(id);
        if (Number.isFinite(numericId)) {
          const r = await getRoundById(numericId);
          if (r) {
            if (mounted) setRound(r);
          }
          const p = await getPlayersForRound(numericId);
          if (mounted) setPlayers(p);
        }
      } catch (e) {
        console.warn('Load player failed', e);
      }
    }
    setup();
    return () => {
      mounted = false;
    };
  }, [id]);

  // reload when returning to this screen (e.g., after navigating back from add/edit)
  useFocusEffect(
    useCallback(() => {
      const numericId = Number(id);
      void loadData(numericId);
    }, [id]),
  );

  const seed = async () => {
    try {
      await addPlayer({ name: 'Garry', speedIndex: 1, email: 'minter5@outlook.com' });
      await addPlayer({ name: 'Carl', speedIndex: 1, email: 'Carlofky@gmail.com' });
      await addPlayer({ name: 'Bill', speedIndex: 1, email: 'bill.steinbock@icloud.com' });
      await addPlayer({ name: 'Ed', speedIndex: 1, email: 'e.mathison@att.net' });
      await addPlayer({ name: 'Joe Gates', speedIndex: 1, email: 'mrjoegates@gmail.com' });
      await addPlayer({ name: 'Joe H', speedIndex: 1, email: 'jhenehan57@gmail.com' });
      await addPlayer({ name: 'Ron W', speedIndex: 1, email: 'ron.wibbels@gmail.com' });
      await addPlayer({ name: 'Richard', speedIndex: 1, email: 'richarray@gmail.com' });
      await addPlayer({ name: 'Greg', speedIndex: 2, email: 'gregweber@twc.com' });
      await addPlayer({ name: 'Larry L', speedIndex: 2, email: 'larryalee13@gmail.com' });
      await addPlayer({ name: 'Larry K', speedIndex: 2, email: 'lekelley1@gmail.com' });
      await addPlayer({ name: 'Ben Finn', speedIndex: 3, email: 'ben.finn1950@gmail.com' });
      await addPlayer({ name: 'Dave', speedIndex: 3, email: 'kybred48@yahoo.com' });
      await addPlayer({ name: 'Huff', speedIndex: 4, email: 'starwars48@msn.com' });
      await addPlayer({ name: 'Brad', speedIndex: 4, email: 'Bniedert@gmail.com' });
      await addPlayer({ name: 'Jack', speedIndex: 5, email: 'jgorbett@aol.com' });
      await addPlayer({ name: 'Jerry', speedIndex: 5, email: 'jlcarr39@att.net' });
      await addPlayer({ name: 'Clark', speedIndex: 2, email: 'cottrell@twc.com' });
      await addPlayer({ name: 'Mike Connelly', speedIndex: 1, email: 'mike.connelly.louisville@gmail.com' });
      await addPlayer({ name: 'Mike Morris', speedIndex: 1, email: 'mtmorris146@gmail.com' });
      const p = await getPlayersForRound(null);
      setPlayers(p);
    } catch (e) {
      console.warn('Seed failed', e);
    }
  };

  const loadData = async (roundId?: number | null) => {
    const p = await getPlayersForRound(null);
    setPlayers(p);
  };

  const toggleActive = useCallback(
    (player: PlayerWithActive) => {
      try {
        const updatedPlayers = players.map((p) => {
          if (p.id === player.id) {
            p.active = !p.active;
          }
          return p;
        });
        setPlayers(updatedPlayers);

        const pMatch = updatedPlayers.find((p) => p.id === player.id);
        if (pMatch) {
          (async () => {
            const numericId = Number(id);
            if (Number.isFinite(numericId)) {
              await setPlayerActiveForRound(numericId, pMatch.id, pMatch.active);
            }
          })();
        }
      } catch (e) {
        console.warn('Toggle failed', e);
      }
    },
    [players, id],
  );

  // Toggle all players active state (header switch)
  const toggleAllPlayers = useCallback(
    async (value: boolean) => {
      try {
        const updated = players.map((p) => ({ ...p, active: value }));
        setPlayers(updated);

        const numericId = Number(id);
        if (Number.isFinite(numericId)) {
          // persist changes for each player for this round
          await Promise.all(updated.map((p) => setPlayerActiveForRound(numericId, p.id, p.active)));
        }
      } catch (e) {
        console.warn('Toggle all failed', e);
      }
    },
    [players, id],
  );

  // navigation router available for edit/add player screens
  // startEdit will navigate to the edit screen
  const startEdit = (player: PlayerWithActive) => {
    router.push(`/players/${player.id}`);
  };

  // Add player navigation
  const addNewPlayer = () => {
    router.push('/players/add');
  };

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

      {players.length === 0 && (
        <View style={styles.stepContainer}>
          <Button title="Seed sample players" onPress={seed} />
        </View>
      )}

      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <ThemedText>{`Players: ${players.length} — Active: ${
          players.filter((p) => p.active).length
        }`}</ThemedText>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => {
          const allActive = players.length > 0 && players.every((p) => !!p.active);
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
                <Switch value={allActive} onValueChange={toggleAllPlayers} disabled={players.length === 0} />
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
                  value={!!item.active}
                  onValueChange={(_val) => {
                    void toggleActive(item);
                  }}
                />
                <ThemedText style={{ marginLeft: 30 }}>{item.name}</ThemedText>
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
