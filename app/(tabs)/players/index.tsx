import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { addPlayer, deletePlayerById, getPlayers, updatePlayerById } from '@/lib/db-helper';

export default function PlayersScreen() {
  const router = useRouter();

  const [players, setPlayers] = useState<any[]>([]);

  async function load() {
    try {
      const rows = await getPlayers(false);
      // getPlayers returns minimal info (name, speedIndex). We'll map to objects with id optionally absent.
      setPlayers(rows as any[]);
    } catch (e) {
      console.warn('Load players failed', e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
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
      const p = await getPlayers();
      setPlayers(p);
    } catch (e) {
      console.warn('Seed failed', e);
    }
  };

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/players/${id}`);
  };

  const addNewPlayer = () => {
    router.push({ pathname: `/players/[id]`, params: { id: 'new' } });
  };

  const confirmDelete = (p: any) => {
    Alert.alert('Delete player', `Delete ${p.name}?. You cannot recover a deleted player.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(p) },
    ]);
  };

  const handleDelete = async (p: any) => {
    try {
      if (!p.id) return;
      await deletePlayerById(p.id);
      await load();
    } catch (e) {
      console.warn('Delete failed', e);
    }
  };

  const toggleAvailable = async (p: any) => {
    try {
      if (!p.id) return;
      await updatePlayerById(p.id, { available: !p.available });
      await load();
    } catch (e) {
      console.warn('Toggle available failed', e);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 }}
      >
        <ThemedText type="subtitle">Players</ThemedText>
        <Button title="Add" onPress={addNewPlayer} />
      </View>
      {players.length === 0 && (
        <View style={styles.stepContainer}>
          <Button title="Seed sample players" onPress={seed} />
        </View>
      )}

      <FlatList
        data={players}
        keyExtractor={(item, i) => String(item.id ?? i)}
        ListHeaderComponent={() => (
          <ThemedView
            style={{
              padding: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderColor: '#ddd',
            }}
          >
            <ThemedText style={{ fontWeight: '700' }}>Name</ThemedText>
            <ThemedText style={{ fontWeight: '700', textAlign: 'right', flex: 1, paddingRight: 20 }}>
              Available
            </ThemedText>
          </ThemedView>
        )}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderColor: '#eee',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Pressable onPress={() => startEdit(item.id)}>
                <View>
                  <ThemedText>{item.name}</ThemedText>
                  <ThemedText style={{ color: '#666' }}>{`Speed: ${item.speedIndex}`}</ThemedText>
                  <ThemedText numberOfLines={2} style={{ color: '#666' }}>{`Email: ${
                    item.email ?? 'not specified'
                  }`}</ThemedText>
                </View>
              </Pressable>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Switch value={!!item.available} onValueChange={() => toggleAvailable(item)} />
            </View>
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
