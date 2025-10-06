import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Switch, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { deletePlayerById, getPlayers, updatePlayerById } from '@/lib/players';

export default function PlayersScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<any[]>([]);

  async function load() {
    try {
      const rows = await getPlayers();
      // getPlayers returns minimal info (name, speedIndex). We'll map to objects with id optionally absent.
      setPlayers(rows as any[]);
    } catch (e) {
      console.warn('Load players failed', e);
    }
  }

  useEffect(() => { void load(); }, []);

  useFocusEffect(useCallback(() => { void load(); }, []));

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/player/${id}`);
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
      <ThemedText type="title" style={{ padding: 12 }}>Players</ThemedText>

      <FlatList
        data={players}
        keyExtractor={(item, i) => String(item.id ?? i)}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text>{item.name}</Text>
              <Text style={{ color: '#666' }}>{`Speed: ${item.speedIndex}`}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch value={!!item.available} onValueChange={() => toggleAvailable(item)} />
              <Button title="Edit" onPress={() => startEdit(item.id)} />
              <Button title="Delete" color="#d00" onPress={() => confirmDelete(item)} />
            </View>
          </View>
        )}
      />
    </ThemedView>
  );
}
