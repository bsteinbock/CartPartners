import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Switch, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { addPlayer, getPlayersForRound, initDb, PlayerWithActive } from '@/lib/db-helper';

export default function HomeScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerWithActive[]>([]);

  useEffect(() => {
    let mounted = true;
    async function setup() {
      try {
        await initDb();
        const p = await getPlayersForRound(null);
        if (mounted) setPlayers(p);
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
    }, []),
  );

  const seed = async () => {
    try {
      await addPlayer({ name: 'Garry', speedIndex: 1 });
      await addPlayer({ name: 'Carl', speedIndex: 1 });
      await addPlayer({ name: 'Bill', speedIndex: 1 });
      await addPlayer({ name: 'Ed', speedIndex: 1 });
      await addPlayer({ name: 'Joe Gates', speedIndex: 1 });
      await addPlayer({ name: 'Joe H', speedIndex: 1 });
      await addPlayer({ name: 'Ron W', speedIndex: 1 });
      await addPlayer({ name: 'Richard', speedIndex: 1 });
      await addPlayer({ name: 'Greg', speedIndex: 2 });
      await addPlayer({ name: 'Larry L', speedIndex: 2 });
      await addPlayer({ name: 'Larry K', speedIndex: 2 });
      await addPlayer({ name: 'Ben Finn', speedIndex: 3 });
      await addPlayer({ name: 'Dave', speedIndex: 3 });
      await addPlayer({ name: 'Huff', speedIndex: 4 });
      await addPlayer({ name: 'Brad', speedIndex: 4 });
      await addPlayer({ name: 'Jack', speedIndex: 5 });
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
          if (p.id === player.id) p.active = !p.active;
          return p;
        });
        setPlayers(updatedPlayers);
      } catch (e) {
        console.warn('Toggle failed', e);
      }
    },
    [players],
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
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Line-up</ThemedText>
      </ThemedView>

      {/* Round picker */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <ThemedText style={{ fontWeight: '600' }}>Select Active Round</ThemedText>
        </View>
        <View style={{ flexDirection: 'row' }}></View>
      </View>

      {players.length === 0 && (
        <View style={styles.stepContainer}>
          <Button title="Seed sample players" onPress={seed} />
        </View>
      )}

      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <Text>{`Players: ${players.length} — Active: ${players.filter((p) => p.active).length}`}</Text>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => (
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
            <ThemedText style={{ fontWeight: '700' }}>Active</ThemedText>
            <ThemedText style={{ fontWeight: '700' }}>Name</ThemedText>
          </ThemedView>
        )}
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
