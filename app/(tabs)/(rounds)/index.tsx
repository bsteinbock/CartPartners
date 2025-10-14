import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getRoundSummaries, initDb } from '@/lib/db-helper';
import { formatDate } from '@/lib/formatters';

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
    router.push({ pathname: '/edit-or-add', params: { id: 'new' } });
  };

  const setLineUp = (r: any) => {
    if (r && typeof r.id !== 'undefined')
      router.push({ pathname: '/[id]/lineup', params: { id: String(r.id) } });
  };

  const openEdit = (r: any) => {
    if (r && typeof r.id !== 'undefined')
      router.push({ pathname: '/edit-or-add', params: { id: String(r.id) } });
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <Button title="Add Round" onPress={createAndOpen} />
      </View>

      <FlatList
        data={rounds}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => openEdit(item)}
            onPress={() => setLineUp(item)}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
          >
            <>
              <ThemedText>{`${item.course} (${formatDate(item.date)})`}</ThemedText>
              <ThemedText type="small">{`${item.numActivePlayers ?? 0} players`}</ThemedText>
            </>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
