import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { deletePlayerById, getPlayers, updatePlayerById } from '@/lib/db-helper';

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

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/players/${id}`);
  };

  const addPlayer = () => {
    router.push({ pathname: `/players/[id]`, params: { id: 'new' } });
  };

  const confirmDelete = (p: any) => {
    Alert.alert('Delete player', `Delete ${p.name}?`, [
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
        <ThemedText type="title">Players</ThemedText>
        <Button title="Add" onPress={addPlayer} />
      </View>
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
            <ThemedText style={{ fontWeight: '700', width: 50 }}></ThemedText>
            {false && <ThemedText style={{ fontWeight: '700' }}>Delete</ThemedText>}
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
            <View>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText style={{ color: '#666' }}>{`Speed: ${item.speedIndex}`}</ThemedText>
              <ThemedText style={{ color: '#666' }}>{`Email: ${item.email ?? 'not specified'}`}</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch value={!!item.available} onValueChange={() => toggleAvailable(item)} />
              <Button title="Edit" onPress={() => startEdit(item.id)} />
              {false && <Button title="Delete" color="#d00" onPress={() => confirmDelete(item)} />}
            </View>
          </View>
        )}
      />
    </ThemedView>
  );
}
