import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { addPlayersToGroup, createGroupForRound, deleteGroupById, deleteGroupsForRound, getGroupsForRound, getPlayersForRound, getRecentActivePlayerIds, getRecentPairCounts, getRoundSummaries, setActiveRound, updateGroupPlayers } from '@/lib/players';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Candidate = { id: number; name: string; speedIndex: number };

export default function GroupsScreen() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [activePlayers, setActivePlayers] = useState<Candidate[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [overwriteOnGenerate, setOverwriteOnGenerate] = useState(false);
  const [trialsState, setTrialsState] = useState(40);
  const [localItersState, setLocalItersState] = useState(120);

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
    const active = (p || []).filter((pp) => pp.active).map((pp) => ({ id: pp.id, name: pp.name, speedIndex: pp.speedIndex }));
    setActivePlayers(active);
  };

  const loadGroups = async (roundId: number | null) => {
    if (roundId == null) return setGroups([]);
    const gs = await getGroupsForRound(roundId);
    setGroups(gs);
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
      const playersSorted = (g.players || []).slice().sort((a: any, b: any) => (a.cart_index - b.cart_index) || (a.slot_index - b.slot_index));
      for (const p of playersSorted) {
        body += `<tr><td>${p.cart_index}</td><td>${p.slot_index}</td><td>${p.name}</td><td>${p.speedIndex ?? (p.speed_index ?? '')}</td></tr>`;
      }
      body += '</tbody></table>';
    }
    return header + body + footer;
  };

  const exportHtml = async () => {
    if (!currentRoundId) return Alert.alert('No round selected');
    if (!groups || groups.length === 0) return Alert.alert('No groups to export for this round');
    const round = rounds.find((r) => r.id === currentRoundId);
    const html = buildHtmlForGroups(groups, currentRoundId, round ? new Date(round.date).toLocaleString() : undefined);
    try {
      await Clipboard.setStringAsync(html);
      Alert.alert('Copied to clipboard', 'The HTML for the current groups has been copied to the clipboard. You can paste it into an email or document.', [
        { text: 'OK' },
        { text: 'Open Email', onPress: () => {
          const subject = encodeURIComponent(`Cart Partners - Round ${currentRoundId} Groups`);
          const body = encodeURIComponent('The HTML for the groups is on the clipboard. Paste it into the email body (long-press and paste).');
          const url = `mailto:?subject=${subject}&body=${body}`;
          Linking.openURL(url).catch(() => { Alert.alert('Could not open mail app'); });
        } }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to copy HTML to clipboard');
    }
  };

  useEffect(() => { void loadRounds(); }, []);

  useEffect(() => {
    void loadActivePlayers(currentRoundId);
    void loadGroups(currentRoundId);
  }, [currentRoundId]);

  const selectRound = async (id: number) => {
    await setActiveRound(id);
    setCurrentRoundId(id);
  };

  // Stronger optimizer: run multiple randomized trials and pick the best according to an objective
  // Objective: minimize repeats with recentIds (heavy weight) and minimize variance of group speed sums
  // - Avoid players used in the last N rounds where possible
  // - Balance groups by sum of speedIndex
  // - Create groups of 4 when possible, allow groups of 3 when needed
  const generateGroups = useCallback(async (opts?: { randomize?: boolean; overwrite?: boolean; trials?: number; localIters?: number }) => {
    if (!currentRoundId) return Alert.alert('No round selected');
    const { activeIds, recentIds } = await getRecentActivePlayerIds(currentRoundId, 3);
    const pairCounts = await getRecentPairCounts(currentRoundId, 3);
    const players = activePlayers.slice();
    if (players.length === 0) return Alert.alert('No active players for this round');
    // stronger optimizer: run multiple trials and pick the best
    const trials = opts?.trials ?? trialsState;
    let bestAssignment: Candidate[][] | null = null;
    let bestScore = Infinity;

    // Objective: penalize repeated pairs (heavy) and variance in group sums
    const computeObjective = (assignment: Candidate[][]) => {
      let pairPenalty = 0;
      const sums: number[] = [];
      for (const grp of assignment) {
        let s = 0;
        for (let i = 0; i < grp.length; i++) {
          for (let j = i + 1; j < grp.length; j++) {
            const a = Math.min(grp[i].id, grp[j].id);
            const b = Math.max(grp[i].id, grp[j].id);
            const key = `${a}:${b}`;
            pairPenalty += (pairCounts[key] || 0) * 100000; // very heavy
          }
          s += grp[i].speedIndex;
        }
        sums.push(s);
      }
      const avg = sums.reduce((a, b) => a + b, 0) / (sums.length || 1);
      const variance = sums.reduce((a, b) => a + (b - avg) * (b - avg), 0) / (sums.length || 1);
      return pairPenalty + variance;
    };

    // Use simulated annealing style: start with randomized candidate and then try swaps
    for (let t = 0; t < trials; t++) {
      // randomized seed per trial
      const pool = players.map((p) => ({ ...p }));
      if (opts?.randomize || t > 0) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }

      // same greedy-with-balance assignment per trial
      pool.sort((a, b) => ((recentIds.includes(a.id) ? 1000 : 0) + a.speedIndex) - ((recentIds.includes(b.id) ? 1000 : 0) + b.speedIndex));
      const minGroupSize = pool.length < 6 ? 3 : 4;
      const estimatedGroups = Math.max(1, Math.floor(pool.length / minGroupSize));
      const groupsArr: Candidate[][] = [];
      for (let i = 0; i < estimatedGroups; i++) groupsArr.push([]);
      const groupSums = new Array(estimatedGroups).fill(0);
      for (const p of pool) {
        let bestIdx = 0;
        let bestVal = Infinity;
        for (let i = 0; i < groupsArr.length; i++) {
          if (groupsArr[i].length >= 4) continue;
          if (groupSums[i] < bestVal) {
            bestVal = groupSums[i];
            bestIdx = i;
          }
        }
        groupsArr[bestIdx].push(p);
        groupSums[bestIdx] += p.speedIndex + (recentIds.includes(p.id) ? 1000 : 0);
      }

      // merge tiny groups
      const small = groupsArr.filter((g) => g.length > 0 && g.length < minGroupSize);
      if (small.length && groupsArr.length > 1) {
        for (const sg of small) {
          for (const p of sg.slice()) {
            let best = -1;
            let bestVal = Infinity;
            for (let i = 0; i < groupsArr.length; i++) {
              if (groupsArr[i] === sg) continue;
              if (groupsArr[i].length >= 4) continue;
              if (groupSums[i] < bestVal) {
                bestVal = groupSums[i];
                best = i;
              }
            }
            if (best === -1) best = 0;
            groupsArr[best].push(p);
            groupSums[best] += p.speedIndex + (recentIds.includes(p.id) ? 1000 : 0);
            const idx = sg.indexOf(p);
            if (idx >= 0) sg.splice(idx, 1);
          }
        }
      }

      let candidate = groupsArr.filter((g) => g.length >= 1).filter((g) => g.length >= Math.min(3, Math.max(1, Math.ceil(pool.length / estimatedGroups))));
      if (!candidate.length) continue;

  // small local optimization: try random swaps and accept if objective improves (hill-climb), repeat a few times
  const localIters = opts?.localIters ?? localItersState;
      let cand = candidate.map((g) => g.slice());
      let candScore = computeObjective(cand);
      for (let li = 0; li < localIters; li++) {
        // pick two groups and two indices
        const g1 = Math.floor(Math.random() * cand.length);
        const g2 = Math.floor(Math.random() * cand.length);
        if (!cand[g1] || !cand[g2] || cand[g1].length === 0 || cand[g2].length === 0) continue;
        const i1 = Math.floor(Math.random() * cand[g1].length);
        const i2 = Math.floor(Math.random() * cand[g2].length);
        // swap
        const backup1 = cand[g1][i1];
        const backup2 = cand[g2][i2];
        cand[g1][i1] = backup2;
        cand[g2][i2] = backup1;
        const newScore = computeObjective(cand);
        if (newScore < candScore) {
          candScore = newScore;
        } else {
          // revert
          cand[g1][i1] = backup1;
          cand[g2][i2] = backup2;
        }
      }

      const sc = candScore;
      if (sc < bestScore) {
        bestScore = sc;
        bestAssignment = cand.map((g) => g.slice());
      }
    }

    if (!bestAssignment) {
      // Fallback: try to create groups ignoring speedIndex, focusing on minimizing repeated pairs.
      // Build simple greedy groups and perform local swaps to reduce pair repeats.
      const pool = players.map((p) => ({ ...p }));
      // shuffle to avoid deterministic ties
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const minGroupSize = pool.length < 6 ? 3 : 4;
      const estimatedGroups = Math.max(1, Math.floor(pool.length / minGroupSize));
      const groupsArr: Candidate[][] = [];
      for (let i = 0; i < estimatedGroups; i++) groupsArr.push([]);
      // greedy round-robin fill to balance counts
      let idx = 0;
      for (const p of pool) {
        groupsArr[idx % groupsArr.length].push(p);
        idx++;
      }

      // local improvement: try swaps to minimize repeated pairs (based on pairCounts)
      const computePairPenalty = (assignment: Candidate[][]) => {
        let penalty = 0;
        for (const grp of assignment) {
          for (let i = 0; i < grp.length; i++) {
            for (let j = i + 1; j < grp.length; j++) {
              const a = Math.min(grp[i].id, grp[j].id);
              const b = Math.max(grp[i].id, grp[j].id);
              const key = `${a}:${b}`;
              penalty += (pairCounts[key] || 0);
            }
          }
        }
        return penalty;
      };

      let fallback = groupsArr.map((g) => g.slice()).filter((g) => g.length > 0);
      let bestFallback = fallback.map((g) => g.slice());
      let bestFallbackScore = computePairPenalty(bestFallback);
      const fallbackIters = Math.max(50, (opts?.localIters ?? localItersState));
      for (let it = 0; it < fallbackIters; it++) {
        // pick two groups and swap random members
        const g1 = Math.floor(Math.random() * fallback.length);
        const g2 = Math.floor(Math.random() * fallback.length);
        if (g1 === g2 || fallback[g1].length === 0 || fallback[g2].length === 0) continue;
        const i1 = Math.floor(Math.random() * fallback[g1].length);
        const i2 = Math.floor(Math.random() * fallback[g2].length);
        const a = fallback[g1][i1];
        const b = fallback[g2][i2];
        fallback[g1][i1] = b;
        fallback[g2][i2] = a;
        const sc = computePairPenalty(fallback);
        if (sc < bestFallbackScore) {
          bestFallbackScore = sc;
          bestFallback = fallback.map((g) => g.slice());
        } else {
          // revert
          fallback[g1][i1] = a;
          fallback[g2][i2] = b;
        }
      }

      if (!bestFallback || !bestFallback.length) return Alert.alert('Could not form groups with constraints');
      bestAssignment = bestFallback;
    }

    // if overwrite requested, delete existing groups first
    if (opts?.overwrite && currentRoundId) {
      await deleteGroupsForRound(currentRoundId);
      await loadGroups(currentRoundId);
    }

    // Persist bestAssignment
    for (const grp of bestAssignment) {
      const gid = await createGroupForRound(currentRoundId);
      if (typeof gid === 'undefined') continue;
      const playersToInsert: { player_id: number; cart_index: number; slot_index: number }[] = [];
      for (let i = 0; i < grp.length; i++) {
        const cart_index = Math.floor(i / 2) + 1;
        const slot_index = (i % 2) + 1;
        playersToInsert.push({ player_id: grp[i].id, cart_index, slot_index });
      }
      await addPlayersToGroup(gid, playersToInsert);
    }

    await loadGroups(currentRoundId);
    Alert.alert('Groups generated', `${bestAssignment.length} groups created`);
  }, [activePlayers, currentRoundId]);

  const draggableRef = useRef<any>(null);

  const renderGroup = ({ item }: { item: any }) => {
    // local editable order
    const [localOrder, setLocalOrder] = useState(item.players.slice());
    const [DraggableFlatList, setDraggableFlatList] = useState<any | null>(null);

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const mod = await import('react-native-draggable-flatlist');
          if (mounted) setDraggableFlatList(() => mod.default);
        } catch (e) {
          // package not installed; we'll gracefully fall back to non-draggable UI
        }
      })();
      return () => { mounted = false; };
    }, []);

    const saveOrder = async (order?: any[]) => {
      const list = order ?? localOrder;
      const playersToInsert: { player_id: number; cart_index: number; slot_index: number }[] = [];
      for (let i = 0; i < list.length; i++) {
        const cart_index = Math.floor(i / 2) + 1;
        const slot_index = (i % 2) + 1;
        playersToInsert.push({ player_id: list[i].player_id, cart_index, slot_index });
      }
      await updateGroupPlayers(item.id, playersToInsert);
      await loadGroups(currentRoundId);
    };

    return (
  <View style={[styles.groupCard, { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600' }}>Group {item.id}</Text>
          <Button title="Delete" color="#d00" onPress={async () => {
            Alert.alert('Delete group', `Delete group ${item.id}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGroupById(item.id); await loadGroups(currentRoundId); } }
            ]);
          }} />
        </View>
        {DraggableFlatList ? (
          // dynamic DraggableFlatList (if package installed)
          <DraggableFlatList
            data={localOrder}
            keyExtractor={(d: any) => `${d.player_id}-${d.cart_index}-${d.slot_index}`}
            onDragEnd={({ data }: any) => setLocalOrder(data)}
            renderItem={({ item: d, drag, isActive }: any) => (
              <Pressable onLongPress={drag} style={{ padding: 8, borderBottomWidth: 1, backgroundColor: isActive ? '#eef' : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, backgroundColor: '#f0f0f0', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <Text style={{ fontSize: 12 }}>≡</Text>
                  </View>
                  <Text>{`${d.name} (cart ${d.cart_index} slot ${d.slot_index})`}</Text>
                </View>
                <Text style={{ color: '#666' }}>{isActive ? 'Dragging' : ''}</Text>
              </Pressable>
            )}
          />
        ) : (
          localOrder.map((p: any, idx: number) => (
            <View key={`${p.player_id}-${p.cart_index}-${p.slot_index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>{`Cart ${p.cart_index} Slot ${p.slot_index}: ${p.name}`}</Text>
            </View>
          ))
        )}
        <View style={{ marginTop: 8 }}>
          <Button title="Save Order" onPress={() => saveOrder()} />
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
            <Pressable style={{ padding: 8, marginRight: 8, borderRadius: 6, backgroundColor: currentRoundId === item.id ? '#0066cc' : '#eee' }} onPress={() => selectRound(item.id)}>
              <Text style={{ color: currentRoundId === item.id ? 'white' : '#222' }}>{`${item.id} • ${new Date(item.date).toLocaleString()} (${item.activeCount ?? 0} active)`}</Text>
            </Pressable>
          )}
        />
      </View>

      <View style={{ padding: 12 }}>
        <Text style={{ marginBottom: 8 }}>Active players: {activePlayers.length}</Text>
        <View style={{ marginBottom: 8 }}>
          <Pressable onPress={() => setOverwriteOnGenerate((s) => !s)} style={{ padding: 8 }}>
            <Text>{overwriteOnGenerate ? '✅ Overwrite existing groups' : '◻️ Overwrite existing groups'}</Text>
          </Pressable>
        </View>
        <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, color: '#444' }}>Trials:</Text>
          <Button title="-" onPress={() => setTrialsState((t) => Math.max(1, t - 5))} />
          <Text style={{ minWidth: 48, textAlign: 'center' }}>{trialsState}</Text>
          <Button title="+" onPress={() => setTrialsState((t) => t + 5)} />
          <Text style={{ fontSize: 12, color: '#444', marginLeft: 12 }}>Local iters:</Text>
          <Button title="-" onPress={() => setLocalItersState((t) => Math.max(10, t - 10))} />
          <Text style={{ minWidth: 48, textAlign: 'center' }}>{localItersState}</Text>
          <Button title="+" onPress={() => setLocalItersState((t) => t + 10)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Generate Groups" onPress={() => { void (async () => {
            if (overwriteOnGenerate) {
              Alert.alert('Overwrite groups', 'This will delete existing groups for this round before generating. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: async () => { await generateGroups({ overwrite: true, trials: trialsState, localIters: localItersState }); } }
              ]);
            } else {
              await generateGroups({ overwrite: false, trials: trialsState, localIters: localItersState });
            }
          })(); }} />
          <Button title="Shuffle & Generate" onPress={() => { void (async () => {
            if (overwriteOnGenerate) {
              Alert.alert('Overwrite groups', 'This will delete existing groups for this round before generating. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: async () => { await generateGroups({ randomize: true, overwrite: true, trials: trialsState, localIters: localItersState }); } }
              ]);
            } else {
              await generateGroups({ randomize: true, overwrite: false, trials: trialsState, localIters: localItersState });
            }
          })(); }} />
          <Button title="Clear Groups" onPress={async () => {
            if (!currentRoundId) return;
            Alert.alert('Confirm', 'Delete all groups for this round?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGroupsForRound(currentRoundId); await loadGroups(currentRoundId); } }
            ]);
          }} />
          <Button title="Export HTML" onPress={() => { void exportHtml(); }} />
        </View>
      </View>

      <View style={{ padding: 12, flex: 1 }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Groups for this round</Text>
        <FlatList data={groups} keyExtractor={(g) => String(g.id)} renderItem={renderGroup} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
