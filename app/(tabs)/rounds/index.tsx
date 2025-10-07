import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createRound, getRoundSummaries, initDb } from '@/lib/db-helper';

export default function RoundsScreen() {
  const router = useRouter();
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function setup() {
      try {
        await initDb();
        const r = await getRoundSummaries();
        if (mounted) setRounds(r as any);
      } catch (e) {
        console.warn('DB init/fetch failed', e);
      }
    }
    setup();
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const r = await getRoundSummaries();
        setRounds(r as any);
      })();
    }, []),
  );

  const createAndOpen = async () => {
    const id = await createRound();
    if (typeof id !== 'undefined')
      router.push({ pathname: '/(tabs)/rounds/[id]', params: { id: String(id) } });
  };

  const openEdit = (r: any) => {
    if (r && typeof r.id !== 'undefined')
      router.push({ pathname: '/(tabs)/rounds/[id]', params: { id: String(r.id) } });
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Rounds</ThemedText>
      </ThemedView>

      <View style={{ padding: 12 }}>
        <Button title="New Round" onPress={createAndOpen} />
      </View>

      <FlatList
        data={rounds}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
          >
            <ThemedText>{`${new Date(item.date).toLocaleDateString()} (${item.course}) — ${
              item.activeCount ?? 0
            } players`}</ThemedText>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
