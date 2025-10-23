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
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Linking, StyleSheet, TouchableOpacity } from 'react-native';

export default function GroupsScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentGroups, setRecentGroups] = useState<CartGroup[]>([]);
  const [isRoundPickerVisible, setIsRoundPickerVisible] = useState<boolean>(false);
  const [pickedRound, setPickedRound] = useState<OptionEntry | undefined>(undefined);
  const [roundOptions, setRoundOptions] = useState<OptionEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const textColor = useThemeColor({ light: undefined, dark: undefined }, 'text');

  const loadRounds = async () => {
    const r = await getRoundSummaries();
    setRounds(r as any);
    if (r && r.length && currentRoundId == null) {
      setCurrentRoundId((r[0] as any).id);
    }
  };

  // Replace the existing useEffect with useFocusEffect
  useFocusEffect(
    useCallback(() => {
      void loadRounds();
    }, []),
  );
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

  const loadActivePlayers = async (roundId: number) => {
    const p = await getPlayersForRound(roundId);
    // filter only active
    const active = (p || [])
      .filter((pp) => pp.active)
      .map((pp) => ({ id: pp.id, name: pp.name, speedIndex: pp.speedIndex }));
    setActivePlayers(active);
  };

  const buildGroupSummary = (groupsToExport: any[]) => {
    let summary = '';
    groupsToExport.forEach((group, index) => {
      const playerNames = (group.players || []).map((p: any) => p.name).join(', ');
      summary += `Group ${index + 1}: ${playerNames}\n`;
    });

    return summary;
  };

  const buildEmailAddresses = (groupsToExport: any[]) => {
    const entries: string[] = [];

    for (const group of groupsToExport || []) {
      for (const p of group.players || []) {
        const email = p?.email?.toString().trim();
        const name = (p?.name ?? '').toString().trim();
        if (email) {
          entries.push(`"${name}"<${email}>`);
        }
      }
    }

    // remove duplicates by email
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
      const m = e.match(/<([^>]+)>$/);
      const key = m ? m[1] : e;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.join(', ');
  };

  const exportToEmail = async () => {
    if (!currentRoundId) return Alert.alert('No round selected');
    if (!groups || groups.length === 0) return Alert.alert('No groups to export for this round');

    const summary = buildGroupSummary(groups);
    const addresses = buildEmailAddresses(groups);

    try {
      await Clipboard.setStringAsync(summary);
      Alert.alert('Copied to clipboard', 'The group summary has been copied to the clipboard.', [
        { text: 'OK' },
        {
          text: 'Open Email',
          onPress: () => {
            const subject = encodeURIComponent(`Cart Assignments - ${pickedRound?.label}`);
            const body = encodeURIComponent(summary);
            const url = `mailto:${addresses}?subject=${subject}&body=${body}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not open mail app');
            });
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to copy summary to clipboard');
    }
  };

  const loadGroupsForRound = async (roundId: number) => {
    const groups = await getGroupsForRound(roundId);
    setGroups(groups);
  };

  useEffect(() => {
    if (currentRoundId !== null) {
      void loadActivePlayers(currentRoundId);
      loadGroupsForRound(currentRoundId);
    }
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
  }, [activePlayers, currentRoundId]);

  const renderGroup = ({ item, index }: { item: CartGroup; index: number }) => {
    return (
      <TouchableOpacity onPress={() => setSelectedIndex(index)} activeOpacity={0.8}>
        <ThemedView
          style={[
            styles.groupCard,
            {
              backgroundColor: backgroundColor,
              borderColor: selectedIndex === index ? '#2f95eb' : borderColor,
              shadowColor: borderColor,
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ fontWeight: '600', color: selectedIndex === index ? '#2f95eb' : textColor }}>
              {`${item.players.map((p) => p.name).join(', ')}`}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  // Add effect to handle selection bounds
  useEffect(() => {
    if (selectedIndex != null && (selectedIndex < 0 || selectedIndex >= groups.length)) {
      setSelectedIndex(groups.length ? 0 : null);
    }
  }, [groups, selectedIndex]);

  const moveGroup = useCallback(
    async (direction: 'up' | 'down') => {
      if (selectedIndex === null) return;

      const newIndex = direction === 'up' ? selectedIndex - 1 : selectedIndex + 1;
      if (newIndex < 0 || newIndex >= groups.length) return;

      const newGroups = [...groups];
      const temp = newGroups[selectedIndex];
      newGroups[selectedIndex] = newGroups[newIndex];
      newGroups[selectedIndex].slot_index = selectedIndex;
      newGroups[newIndex] = { ...temp, slot_index: newIndex };
      if (currentRoundId) {
        try {
          await setGroupsForRound(currentRoundId, newGroups);
          setGroups(newGroups);
          setSelectedIndex(newIndex);
        } catch (e) {
          Alert.alert('Error', `Failed to generate groups. ${e}`);
        }
      }
    },
    [currentRoundId, selectedIndex, groups],
  );

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

        {/* Add controls */}
        <ThemedView style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
          <Button
            title="Move Up"
            onPress={() => moveGroup('up')}
            disabled={selectedIndex === null || selectedIndex === 0}
          />
          <Button
            title="Move Down"
            onPress={() => moveGroup('down')}
            disabled={selectedIndex === null || selectedIndex === groups.length - 1}
          />
        </ThemedView>

        <FlatList data={groups} keyExtractor={(g, index) => String(index)} renderItem={renderGroup} />
        <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Export to Email"
            onPress={() => {
              void exportToEmail();
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
