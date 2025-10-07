import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPlayersForRound, getRoundSummaries, Player } from '@/lib/db-helper';
import { createCartGroupings, Group } from '@/lib/group-utils';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

export default function GroupsScreen() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [overwriteOnGenerate, setOverwriteOnGenerate] = useState(false);

  const loadRounds = async () => {
    const r = await getRoundSummaries();
    setRounds(r as any);
    if (r && r.length && currentRoundId == null) {
      setCurrentRoundId((r[0] as any).id);
    }
  };

  const loadActivePlayers = async (roundId: number | null) => {
    const p = await getPlayersForRound(roundId ?? null);
    // filter only active
    const active = (p || [])
      .filter((pp) => pp.active)
      .map((pp) => ({ id: pp.id, name: pp.name, speedIndex: pp.speedIndex }));
    setActivePlayers(active);
  };

  const buildHtmlForGroups = (groupsToExport: any[], roundId: number | null, roundDate?: string) => {
    const title = `Groups for round ${roundId ?? ''}`;
    const header = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:12px;color:#111}h1{font-size:18px}table{border-collapse:collapse;margin-bottom:12px}td,th{border:1px solid #ddd;padding:8px}th{background:#f6f6f6}</style></head><body>`;
    const footer = '</body></html>';
    let body = `<h1>${title}</h1>`;
    if (roundDate) body += `<div><strong>Date:</strong> ${roundDate}</div>`;
    body += `<div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>`;
    for (const g of groupsToExport) {
      body += `<h2>Group ${g.id}</h2>`;
      body += '<table><thead><tr><th>Cart</th><th>Slot</th><th>Player</th><th>Speed</th></tr></thead><tbody>';
      // sort players by cart_index then slot_index
      const playersSorted = (g.players || [])
        .slice()
        .sort((a: any, b: any) => a.cart_index - b.cart_index || a.slot_index - b.slot_index);
      for (const p of playersSorted) {
        body += `<tr><td>${p.cart_index}</td><td>${p.slot_index}</td><td>${p.name}</td><td>${
          p.speedIndex ?? p.speed_index ?? ''
        }</td></tr>`;
      }
      body += '</tbody></table>';
    }
    return header + body + footer;
  };

  const exportHtml = async () => {
    if (!currentRoundId) return Alert.alert('No round selected');
    if (!groups || groups.length === 0) return Alert.alert('No groups to export for this round');
    const round = rounds.find((r) => r.id === currentRoundId);
    const html = buildHtmlForGroups(
      groups,
      currentRoundId,
      round ? new Date(round.date).toLocaleString() : undefined,
    );
    try {
      await Clipboard.setStringAsync(html);
      Alert.alert(
        'Copied to clipboard',
        'The HTML for the current groups has been copied to the clipboard. You can paste it into an email or document.',
        [
          { text: 'OK' },
          {
            text: 'Open Email',
            onPress: () => {
              const subject = encodeURIComponent(`Cart Partners - Round ${currentRoundId} Groups`);
              const body = encodeURIComponent(
                'The HTML for the groups is on the clipboard. Paste it into the email body (long-press and paste).',
              );
              const url = `mailto:?subject=${subject}&body=${body}`;
              Linking.openURL(url).catch(() => {
                Alert.alert('Could not open mail app');
              });
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to copy HTML to clipboard');
    }
  };

  useEffect(() => {
    void loadRounds();
  }, []);

  useEffect(() => {
    void loadActivePlayers(currentRoundId);
    //void loadGroups(currentRoundId);
  }, [currentRoundId]);

  const selectRound = async (id: number) => {
    setCurrentRoundId(id);
  };

  const renderGroup = ({ item }: { item: Group }) => {
    return (
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600' }}> {`${item.players.map((p) => p.name).join(', ')}`}</Text>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <ThemedText type="title">Groups</ThemedText>
      </View>

      <View style={{ paddingHorizontal: 12 }}>
        <Text style={{ marginBottom: 8, fontWeight: '600' }}>Select Round</Text>
        <FlatList
          horizontal
          data={rounds}
          keyExtractor={(r: any) => String(r.id)}
          renderItem={({ item }: any) => (
            <Pressable
              style={{
                padding: 8,
                marginRight: 8,
                borderRadius: 6,
                backgroundColor: currentRoundId === item.id ? '#0066cc' : '#eee',
              }}
              onPress={() => selectRound(item.id)}
            >
              <Text style={{ color: currentRoundId === item.id ? 'white' : '#222' }}>{`${
                item.id
              } • ${new Date(item.date).toLocaleString()} (${item.activeCount ?? 0} active)`}</Text>
            </Pressable>
          )}
        />
      </View>

      <View style={{ padding: 12 }}>
        <Text style={{ marginBottom: 8 }}>Active players: {activePlayers.length}</Text>
        <View style={{ marginBottom: 8 }}>
          <Pressable onPress={() => setOverwriteOnGenerate((s) => !s)} style={{ padding: 8 }}>
            <Text>
              {overwriteOnGenerate ? '✅ Overwrite existing groups' : '◻️ Overwrite existing groups'}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Generate Groups" onPress={() => setGroups(createCartGroupings(activePlayers, []))} />
          <Button
            title="Export HTML"
            onPress={() => {
              void exportHtml();
            }}
          />
        </View>
      </View>

      <View style={{ padding: 12, flex: 1 }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Groups for this round</Text>
        <FlatList data={groups} keyExtractor={(g, index) => String(index)} renderItem={renderGroup} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
