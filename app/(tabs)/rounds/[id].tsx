import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { deleteGroupsForRound, getRoundSummaries } from '@/lib/db-helper';

type Params = { id: string };

export default function RoundEdit() {
  const { id } = useLocalSearchParams() as Params;
  const router = useRouter();
  const [round, setRound] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      const sums = await getRoundSummaries();
      const found = (sums as any).find((r: any) => String(r.id) === String(id));
      if (mounted) setRound(found || null);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!round) {
    return (
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  const mark = async (status: any) => {
    const sums = await getRoundSummaries();
    const found = (sums as any).find((r: any) => r.id === round.id);
    setRound(found || null);
  };

  const removeGroups = async () => {
    Alert.alert('Delete groups', 'Delete all groups for this round?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGroupsForRound(round.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title">{`Round ${round.id}`}</ThemedText>
      <View style={{ marginTop: 12 }}>
        <Text>{`Date: ${new Date(round.date).toLocaleString()}`}</Text>
        <Text>{`Status: ${round.status}`}</Text>
        <View style={{ marginTop: 12 }}>
          <Button title="Mark completed" onPress={() => mark('completed')} />
          <View style={{ height: 8 }} />
          <Button title="Mark canceled" onPress={() => mark('canceled')} />
          <View style={{ height: 8 }} />
          <Button title="Delete all groups for round" color="#d00" onPress={removeGroups} />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({});
