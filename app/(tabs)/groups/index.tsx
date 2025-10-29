import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import { GroupPlayers, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  buildPlayingPartnerFrequencies,
  formatGroupPlayersByNames,
  generateNextRoundGroups,
  getGroupPlayersByRoundId,
  getMailtoStrings,
  groupPlayersMatchActivePlayers,
  reportGroupsWithNames,
} from '@/lib/cart-utils';
import { formatDate } from '@/lib/formatters';
import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

export default function GroupsScreen() {
  const {
    rounds,
    groups,
    groupPlayers,
    players,
    roundPlayers,
    setGroupsForRound,
    swapGroupSlots,
    currentRoundId,
    setCurrentRoundId,
  } = useDbStore();
  const [currentRoundPlayerIds, setCurrentRoundPlayerIds] = useState<number[]>([]);
  const [isRoundPickerVisible, setIsRoundPickerVisible] = useState<boolean>(false);
  const [showMismatchPlayerWarning, setShowMismatchPlayerWarning] = useState<boolean>(false);
  const [pickedRound, setPickedRound] = useState<OptionEntry | undefined>(undefined);
  const [roundOptions, setRoundOptions] = useState<OptionEntry[]>([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const textColor = useThemeColor({ light: undefined, dark: undefined }, 'text');
  const errorText = useThemeColor({ light: undefined, dark: undefined }, 'errorText');
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const iconButtonDisabled = useThemeColor({ light: undefined, dark: undefined }, 'iconButtonDisabled');
  const [currentRoundGroups, setCurrentRoundGroups] = useState<GroupPlayers[]>([]);
  const [groupPlayersNames, setGroupPlayerNames] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // useFocusEffect runs every time this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setSelectedGroupIndex(null);
    }, []),
  );
  useEffect(() => {
    const availableOptions = rounds.map((r) => ({
      label: `${r.course} (${formatDate(r.date)})`,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setRoundOptions([]);
    } else {
      const latestRound = availableOptions.find((o) => o.value === currentRoundId) ?? availableOptions[0];
      setPickedRound(latestRound);
      setRoundOptions(availableOptions);
    }
  }, [rounds]);

  useEffect(() => {
    const latestRound = roundOptions.find((o) => o.value === currentRoundId) ?? roundOptions[0];
    setPickedRound(latestRound);
  }, [currentRoundId, roundOptions]);

  const handleRoundOptionChange = (option: OptionEntry) => {
    setPickedRound(option);
    setCurrentRoundId(option.value);
    setIsRoundPickerVisible(false);
  };

  useEffect(() => {
    if (currentRoundId !== null) {
      setCurrentRoundGroups(getGroupPlayersByRoundId(currentRoundId, groups, groupPlayers));
    }
  }, [currentRoundId, groups, groupPlayers, getGroupPlayersByRoundId]);

  useEffect(() => {
    if (currentRoundGroups.length > 0) {
      const names = formatGroupPlayersByNames(currentRoundGroups, players);
      setGroupPlayerNames(names);
    }
  }, [currentRoundGroups, players, formatGroupPlayersByNames]);

  useEffect(() => {
    if (roundPlayers.length > 0) {
      const ids = roundPlayers.filter((rp) => rp.round_id === currentRoundId).map((rpe) => rpe.player_id);
      setCurrentRoundPlayerIds(ids);
    }
  }, [roundPlayers, currentRoundId]);

  useEffect(() => {
    if (currentRoundGroups.length > 0) {
      const isMatching = groupPlayersMatchActivePlayers(currentRoundGroups, currentRoundPlayerIds);
      setShowMismatchPlayerWarning(!isMatching);
    } else {
      setShowMismatchPlayerWarning(false);
    }
  }, [currentRoundGroups, currentRoundPlayerIds]);

  const exportToEmail = async () => {
    if (currentRoundGroups.length === 0) return Alert.alert('No groups to export for this round');

    const summary = reportGroupsWithNames(currentRoundGroups, players);
    const addresses = getMailtoStrings(currentRoundGroups, players);

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

  const selectRound = async (id: number) => {
    setCurrentRoundId(id);
  };

  const handleGenerateGroupings = useCallback(async () => {
    if (currentRoundPlayerIds.length === 0) {
      Alert.alert('No active players', 'Please select a round with active players to generate groups.');
      return;
    }
    const partnerFrequencies = buildPlayingPartnerFrequencies(currentRoundPlayerIds, groupPlayers);

    const newGroupList = generateNextRoundGroups({
      playerIds: currentRoundPlayerIds,
      partnerFrequencies,
      allPlayers: players,
    });

    setGroupsForRound(currentRoundId!, newGroupList);
  }, [
    currentRoundPlayerIds,
    groupPlayers,
    currentRoundId,
    players,
    buildPlayingPartnerFrequencies,
    generateNextRoundGroups,
    setGroupsForRound,
  ]);

  // Render each group in the FlatList
  const renderGroup = ({ item, index }: { item: GroupPlayers; index: number }) => {
    return (
      <TouchableOpacity
        onPress={() => setSelectedGroupIndex(selectedGroupIndex === index ? null : index)}
        activeOpacity={0.8}
      >
        <ThemedView
          style={[
            styles.groupCard,
            {
              backgroundColor: backgroundColor,
              borderColor: selectedGroupIndex === index ? '#2f95eb' : borderColor,
              shadowColor: borderColor,
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText
              style={{ fontWeight: '600', color: selectedGroupIndex === index ? '#2f95eb' : textColor }}
            >
              {`${groupPlayersNames[index]}`}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  // Add effect to handle selection bounds
  useEffect(() => {
    if (selectedGroupIndex != null && (selectedGroupIndex < 0 || selectedGroupIndex >= groups.length)) {
      setSelectedGroupIndex(groups.length ? 0 : null);
    }
  }, [groups, selectedGroupIndex]);

  // Debounced DB save helper - we debounce calls by 250 ms to prevent SQLite from being hammered
  // if the user quickly taps multiple players in a row.
  const persistSwap = (
    groupId1: number,
    swapIndex1: number,
    groupId2: number,
    swapIndex2: number,
    newSelectionIndex: number,
  ) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      swapGroupSlots(groupId1, swapIndex1, groupId2, swapIndex2);
      setSelectedGroupIndex(newSelectionIndex);
    }, 100);
  };

  const moveGroup = useCallback(
    async (direction: 'up' | 'down') => {
      if (selectedGroupIndex === null) return;
      const group1 = currentRoundGroups[selectedGroupIndex];
      const swapIndex = direction === 'down' ? selectedGroupIndex + 1 : selectedGroupIndex - 1;
      const group2 = currentRoundGroups[swapIndex];
      persistSwap(group1.group_id, selectedGroupIndex, group2.group_id, swapIndex, swapIndex);
    },
    [currentRoundId, selectedGroupIndex, persistSwap, currentRoundGroups],
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="title">Tee Groups</ThemedText>
          {currentRoundPlayerIds.length > 0 && (
            <Pressable
              onPress={() => {
                router.push('/(tabs)/groups/manualGroups');
              }}
            >
              <Feather name="edit" size={28} color={iconButton} />
            </Pressable>
          )}
        </View>
        {rounds.length === 0 ? (
          <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
            At least one Rounds must be defined and its line-up of players set before Groups can be generated.
          </ThemedText>
        ) : (
          <>
            <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Select Round</ThemedText>
            <OptionPickerItem
              containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
              optionLabel={pickedRound?.label}
              placeholder="Select Round"
              onPickerButtonPress={() => setIsRoundPickerVisible(true)}
            />
            {currentRoundPlayerIds.length === 0 ? (
              <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
                The line-up of players for this round has not been set. Please return to the Rounds tab and
                tap the round to select players.
              </ThemedText>
            ) : (
              <>
                <ThemedView
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: 12,
                    paddingTop: 12,
                  }}
                >
                  <Button
                    title={currentRoundGroups.length ? 'Regenerate Groups' : 'Generate Groups'}
                    onPress={handleGenerateGroupings}
                  />
                  {currentRoundGroups.length && (
                    <Pressable
                      onPress={() => {
                        void exportToEmail();
                      }}
                    >
                      <Feather name="send" size={28} color={iconButton} />
                    </Pressable>
                  )}
                </ThemedView>
                {showMismatchPlayerWarning && (
                  <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
                    The line-up of players for this round has changed since the groups were initially created.
                    It is recommended that the groups be regenerate to handle line-up changes.
                  </ThemedText>
                )}
                {currentRoundGroups.length && (
                  <ThemedView style={{ padding: 0, flex: 1 }}>
                    <ThemedView
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        alignItems: 'center',
                        height: 46,
                      }}
                    >
                      <ThemedText type="subtitle">Tee Order</ThemedText>
                      <>
                        {selectedGroupIndex !== null && (
                          <ThemedView style={{ flexDirection: 'row', gap: 20 }}>
                            <Pressable onPress={() => moveGroup('up')} disabled={selectedGroupIndex === 0}>
                              <Entypo
                                name="arrow-bold-up"
                                size={28}
                                color={selectedGroupIndex === 0 ? iconButtonDisabled : iconButton}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => moveGroup('down')}
                              disabled={selectedGroupIndex === currentRoundGroups.length - 1}
                            >
                              <Entypo
                                name="arrow-bold-down"
                                size={28}
                                color={
                                  selectedGroupIndex === currentRoundGroups.length - 1
                                    ? iconButtonDisabled
                                    : iconButton
                                }
                              />
                            </Pressable>
                          </ThemedView>
                        )}
                      </>
                    </ThemedView>
                    <ThemedView style={{ flex: 1 }}>
                      <FlatList
                        data={currentRoundGroups}
                        keyExtractor={(g, index) => `${g.group_id}-${index}`}
                        renderItem={renderGroup}
                      />
                    </ThemedView>
                  </ThemedView>
                )}
              </>
            )}
          </>
        )}
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
