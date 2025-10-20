import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  CartGroup,
  convertGroupsToCartGroups,
  getGroupsForPreviousRound,
  getGroupsForRound,
  getPlayersForRound,
  getRoundSummaries,
  Group,
  Player,
  Round,
  setGroupsForRound,
} from '@/lib/db-helper';
import { formatDate } from '@/lib/formatters';
import { createCartGroupings } from '@/lib/group-utils';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Linking, StyleSheet } from 'react-native';

export default function GroupsScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentGroups, setRecentGroups] = useState<CartGroup[]>([]);
  const [isRoundPickerVisible, setIsRoundPickerVisible] = useState<boolean>(false);
  const [pickedRound, setPickedRound] = useState<OptionEntry | undefined>(undefined);
  const [roundOptions, setRoundOptions] = useState<OptionEntry[]>([]);
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');

  const loadRounds = async () => {
    const r = await getRoundSummaries();
    setRounds(r as any);
    if (r && r.length && currentRoundId == null) {
      setCurrentRoundId((r[0] as any).id);
    }
  };

  useEffect(() => {
    const availableOptions = rounds.map((r) => {
      return { label: `${r.course}(${formatDate(r.date)})`, value: r.id };
    });
    if (availableOptions.length === 0) {
      availableOptions.push({ label: 'No rounds defined', value: 0 });
      setRoundOptions(availableOptions);
    } else {
      const latestRound = availableOptions[0];
      setPickedRound(latestRound);
      setCurrentRoundId(latestRound.value);
      setRoundOptions(availableOptions);
    }
  }, [rounds]);

  const handleRoundOptionChange = (option: OptionEntry) => {
    setPickedRound(option);
    setCurrentRoundId(option.value);
    setIsRoundPickerVisible(false);
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

  const loadGroupsForRound = async (roundId: number) => {
    const groups = await getGroupsForRound(roundId);
    setGroups(groups);
  };

  useEffect(() => {
    void loadActivePlayers(currentRoundId);
    if (currentRoundId !== null) loadGroupsForRound(currentRoundId);
  }, [currentRoundId]);

  // Load recent groups when the current round changes
  useEffect(() => {
    let mounted = true;
    const loadRecent = async () => {
      if (currentRoundId == null) {
        if (mounted) setRecentGroups([]);
        return;
      }
      try {
        const previousGroups = await getGroupsForPreviousRound(currentRoundId);
        if (mounted) {
          const recentCartGroups = convertGroupsToCartGroups(previousGroups);
          setRecentGroups(recentCartGroups);
        }
      } catch (e) {
        if (mounted) setRecentGroups([]);
      }
    };
    void loadRecent();
    return () => {
      mounted = false;
    };
  }, [currentRoundId]);

  const selectRound = async (id: number) => {
    setCurrentRoundId(id);
  };

  const handleGenerateGroupings = useCallback(async () => {
    const newGroupings = createCartGroupings(activePlayers, recentGroups);
    if (currentRoundId !== null) {
      try {
        await setGroupsForRound(currentRoundId, newGroupings);
        setGroups(newGroupings);
      } catch (e) {
        Alert.alert('Error', `Failed to generate groups. ${e}`);
      }
    }
  }, [activePlayers]);

  const renderGroup = ({ item }: { item: CartGroup }) => {
    return (
      <ThemedView
        style={[
          styles.groupCard,
          {
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            shadowColor: borderColor,
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          },
        ]}
      >
        <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText style={{ fontWeight: '600' }}>
            {`${item.players.map((p) => p.name).join(', ')}`}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
        <ThemedText style={{ marginBottom: 8 }}>Select Round</ThemedText>

        <OptionPickerItem
          containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
          optionLabel={pickedRound?.label}
          placeholder="Select Round"
          onPickerButtonPress={() => setIsRoundPickerVisible(true)}
        />
      </ThemedView>

      <ThemedView style={{ padding: 12 }}>
        <ThemedText style={{ marginBottom: 8 }}>Active players: {activePlayers.length}</ThemedText>

        <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Generate Groups" onPress={handleGenerateGroupings} />
        </ThemedView>
      </ThemedView>

      <ThemedView style={{ padding: 12, flex: 1 }}>
        <ThemedText style={{ fontWeight: '600', marginBottom: 8 }}>Groups for this round</ThemedText>
        <FlatList data={groups} keyExtractor={(g, index) => String(index)} renderItem={renderGroup} />
        <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Export HTML"
            onPress={() => {
              void exportHtml();
            }}
          />
        </ThemedView>
      </ThemedView>
      {roundOptions && isRoundPickerVisible && (
        <BottomSheetContainer
          isVisible={isRoundPickerVisible}
          title="Select Round"
          modalHeight="70%"
          onClose={() => setIsRoundPickerVisible(false)}
        >
          <OptionList
            options={roundOptions}
            onSelect={(option) => handleRoundOptionChange(option)}
            selectedOption={pickedRound}
          />
        </BottomSheetContainer>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
