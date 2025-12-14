import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import ThemedButton from '@/components/ui/ThemedButton';
import { GroupPlayers, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  buildPlayingPartnerFrequencies,
  formatGroupPlayersByNames,
  formatManualGroupPlayersByNames,
  generateGroupsForRound,
  getGroupPlayersByRoundId,
  getMailtoStrings,
  getMobilePhoneNumbersForGroups,
  groupPlayersMatchActivePlayers,
  reportGroupsWithNames,
} from '@/lib/cart-utils';
import { formatDate } from '@/lib/formatters';
import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SMS from 'expo-sms';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupsScreen() {
  const {
    rounds,
    groups,
    groupPlayers,
    league_players,
    all_players,
    roundPlayers,
    setGroupsForRound,
    swapGroupSlots,
    currentRoundId,
    setCurrentRoundId,
    setManualGroupList,
    manualGroupList,
    leagues,
    currentLeagueId,
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
  const [manualGroupsPlayersNames, setManualGroupsPlayersNames] = useState<string[]>([]);
  const [groupPlayersNames, setGroupPlayerNames] = useState<string[]>([]);
  const [roundTeeTimeInfo, setRoundTeeTimeInfo] = useState<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const [groupCoordinatorId, setGroupCoordinatorId] = useState<number>(0);
  const [myMobileNumber, setMyMobileNumber] = useState<string | null>(null);
  const league = leagues.find((l) => l.id === currentLeagueId);
  const [isSmsAvailable, setIsSmsAvailable] = useState<boolean>(false);

  useFocusEffect(
    React.useCallback(() => {
      setSelectedGroupIndex(null);
      console.log('GroupsScreen focused, resetting selectedGroupIndex');
    }, []),
  );

  // Check SMS availability on mount
  useEffect(() => {
    (async () => {
      const available = await SMS.isAvailableAsync();
      setIsSmsAvailable(available);
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Load saved number on mount
      (async () => {
        const coordinatorIdString = await SecureStore.getItemAsync('cartPartnerGroupCoordinatorId');
        const coordinatorId: number = coordinatorIdString ? parseInt(coordinatorIdString, 10) : 0;
        setGroupCoordinatorId(coordinatorId);
      })();
    }, []),
  );

  useEffect(() => {
    // get mobile number for coordinator
    const coordinator = league_players.find((p) => p.id === groupCoordinatorId);
    if (coordinator && coordinator.mobile_number) {
      setMyMobileNumber(coordinator.mobile_number);
    } else {
      setMyMobileNumber(null);
    }
  }, [groupCoordinatorId, league_players]);

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
  }, [rounds, currentRoundId]);

  useEffect(() => {
    const latestRound = roundOptions.find((o) => o.value === currentRoundId) ?? roundOptions[0];
    setPickedRound(latestRound);
    const matchingRound = rounds.find((r) => r.id === currentRoundId);
    if (matchingRound) {
      setRoundTeeTimeInfo(matchingRound.teeTimeInfo);
    }
  }, [currentRoundId, roundOptions, rounds]);

  const handleRoundOptionChange = (option: OptionEntry) => {
    setPickedRound(option);
    setCurrentRoundId(option.value);
    setIsRoundPickerVisible(false);
  };

  useEffect(() => {
    if (currentRoundId !== null) {
      setCurrentRoundGroups(getGroupPlayersByRoundId(currentRoundId, groups, groupPlayers));
    }
  }, [currentRoundId, groups, groupPlayers]);

  useEffect(() => {
    if (currentRoundGroups.length > 0) {
      const names = formatGroupPlayersByNames(currentRoundGroups, all_players);
      setGroupPlayerNames(names);
    }
  }, [currentRoundGroups, all_players]);

  useEffect(() => {
    if (manualGroupList.length > 0) {
      const names = formatManualGroupPlayersByNames(manualGroupList, league_players);
      setManualGroupsPlayersNames(names);
    }
  }, [manualGroupList, league_players]);

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

  const sendTextMessage = async (addresses: string[] | string, message: string) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS not available on this device');
      return;
    }

    // Normalize addresses into an array
    const recipients = Array.isArray(addresses) ? addresses.filter(Boolean) : [addresses];
    if (recipients.length === 0) {
      Alert.alert('No valid phone numbers found');
      return;
    }

    // --- Split recipients into batches of 20 ---
    const chunkSize = 20;
    let numberGroups: string[][] = [];
    for (let i = 0; i < recipients.length; i += chunkSize) {
      numberGroups.push(recipients.slice(i, i + chunkSize));
    }

    // --- Balance the final groups ---
    if (numberGroups.length > 1) {
      const lastGroup = numberGroups[numberGroups.length - 1];
      const secondLastGroup = numberGroups[numberGroups.length - 2];

      // If the last group is very small (<=5), pull some from the previous one
      if (lastGroup.length <= 5 && secondLastGroup.length > 5) {
        const needed = 6 - lastGroup.length; // aim for ~6 or more in the last batch
        const moved = secondLastGroup.splice(-needed);
        numberGroups[numberGroups.length - 1] = [...moved, ...lastGroup];
      }
    }

    // --- Confirm before sending multiple messages ---
    if (numberGroups.length > 1) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Multiple Messages Required',
          `You have ${recipients.length} recipients.\n\nThis will send ${numberGroups.length} separate messages (max 20 recipients each). Proceed?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'OK', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    try {
      // --- Send messages sequentially ---
      for (let i = 0; i < numberGroups.length; i++) {
        const group = numberGroups[i];
        if (numberGroups.length > 1) {
          Alert.alert(`Sending message ${i + 1} of ${numberGroups.length}...`);
        }

        await SMS.sendSMSAsync(group, message);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      Alert.alert('Error', 'Failed to send one or more messages.');
    }
  };

  const informPlayers = async () => {
    if (currentRoundGroups.length === 0) return Alert.alert('No groups to export for this round');

    let bodyText = roundTeeTimeInfo ? `${roundTeeTimeInfo}\n\n` : '';
    const summary = reportGroupsWithNames(currentRoundGroups, league_players);
    bodyText += summary;
    const textMessageBody = `Cart Groups - ${pickedRound?.label}\n\n${bodyText}`;

    const addresses = getMailtoStrings(currentRoundGroups, league_players);
    const mobileNumbers = getMobilePhoneNumbersForGroups(currentRoundGroups, league_players);

    try {
      Alert.alert('Send Groups Summary', 'Select method of sharing', [
        {
          text: 'Email',
          onPress: () => {
            const subject = encodeURIComponent(`Cart Groups - ${pickedRound?.label}`);
            const body = encodeURIComponent(bodyText);
            const url = `mailto:${addresses}?subject=${subject}&body=${body}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not open mail app');
            });
          },
        },
        ...(mobileNumbers.length > 0 && isSmsAvailable
          ? [
              {
                text: 'Text Msg',
                onPress: async () => {
                  // don't include my number in the list for texting
                  if (myMobileNumber) {
                    if (myMobileNumber.trim().length > 0) {
                      const index = mobileNumbers.indexOf(myMobileNumber);
                      if (index > -1) {
                        mobileNumbers.splice(index, 1);
                      }
                    }

                    await sendTextMessage(mobileNumbers, textMessageBody);
                  } else {
                    if (groupCoordinatorId) {
                      Alert.alert(
                        'No Mobile Number',
                        'The group coordinator does not have a mobile number defined So we cannot send text message.',
                      );
                    } else {
                      // use router to send me to a screen to enter my number
                      router.push({
                        pathname: '/(tabs)/groups/setGroupCoordinator',
                        params: { bodyText: textMessageBody, mobileNumbers: JSON.stringify(mobileNumbers) },
                      });
                    }
                  }
                },
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (e: any) {
      Alert.alert('Error', `Unable to send text message: ${e && e.message ? e.message : 'Unknown error'}`);
    }
  };

  const generateGroups = () => {
    let playerIds = [...currentRoundPlayerIds];

    if (manualGroupList.length) {
      // build a list of playerIds by take currentRoundPlayerIds and removing any id specified in the manualGroupList array
      const manualGroupPlayerIds = manualGroupList.flat().flat();
      playerIds = playerIds.filter((pid) => !manualGroupPlayerIds.includes(pid));
    }

    const partnerFrequencies = buildPlayingPartnerFrequencies(playerIds, groupPlayers);

    let newGroupList = generateGroupsForRound({
      playerIds,
      partnerFrequencies,
      allPlayers: all_players,
    });

    if (manualGroupList.length) {
      newGroupList = [...manualGroupList, ...newGroupList];
    }

    setGroupsForRound(currentRoundId!, newGroupList);
    setManualGroupList([]);
  };

  const handleGenerateGroupings = async () => {
    if (currentRoundPlayerIds.length === 0) {
      Alert.alert('No active players', 'Please select a round with active players to generate groups.');
      return;
    }

    if (currentRoundGroups.length > 0 && !showMismatchPlayerWarning) {
      Alert.alert(
        'Overwrite Current Tee Groups',
        'Are you sure you want to create a new set of Tee Groupings?',
        [{ text: 'Cancel' }, { text: 'Yes', onPress: () => generateGroups() }],
        { cancelable: true },
      );
      return;
    } else {
      generateGroups();
    }
  };

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

  // Render each group in the FlatList
  const renderManualGroup = ({ item, index }: { item: string; index: number }) => {
    return (
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
          <ThemedText style={{ fontWeight: '600' }}>{`${item}`}</ThemedText>
        </ThemedView>
      </ThemedView>
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

  const moveGroup = async (direction: 'up' | 'down') => {
    if (selectedGroupIndex === null) return;
    const group1 = currentRoundGroups[selectedGroupIndex];
    const swapIndex = direction === 'down' ? selectedGroupIndex + 1 : selectedGroupIndex - 1;
    const group2 = currentRoundGroups[swapIndex];
    persistSwap(group1.group_id, selectedGroupIndex, group2.group_id, swapIndex, swapIndex);
  };

  const modifyGroup = () => {
    if (selectedGroupIndex === null) return;
    router.push({
      pathname: '/(tabs)/groups/modifyGroup',
      params: { groupId: String(currentRoundGroups[selectedGroupIndex].group_id) },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={{ flex: 1 }}>
        <ThemedView style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedView>
              <ThemedText type="title">Tee Groups</ThemedText>
              <ThemedText type="small">{league?.name}</ThemedText>
            </ThemedView>

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
              At least one round must be defined and its lineup of players set before groups can be generated.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={{ marginTop: 16, marginBottom: 8 }}>Round</ThemedText>
              <OptionPickerItem
                containerStyle={{ backgroundColor: backgroundColor, height: 36 }}
                optionLabel={pickedRound?.label}
                placeholder="Select Round"
                onPickerButtonPress={() => setIsRoundPickerVisible(true)}
              />
              {currentRoundPlayerIds.length === 0 ? (
                <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
                  The lineup of players for this round has not been set. Please return to the Rounds tab and
                  tap the round to select league_players.
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
                    <ThemedView style={{ borderColor: iconButton, borderWidth: 1, borderRadius: 6 }}>
                      <ThemedButton
                        title={
                          currentRoundGroups.length > 0 && manualGroupList.length === 0
                            ? 'Regenerate Groups'
                            : 'Generate Groups'
                        }
                        onPress={handleGenerateGroupings}
                      />
                    </ThemedView>
                    {currentRoundGroups.length > 0 && manualGroupList.length === 0 && (
                      <Pressable
                        onPress={() => {
                          void informPlayers();
                        }}
                      >
                        <Feather name="send" size={28} color={iconButton} />
                      </Pressable>
                    )}
                  </ThemedView>
                  {showMismatchPlayerWarning && (
                    <ThemedText type="defaultSemiBold" style={{ color: errorText, padding: 10 }}>
                      The lineup of players for this round has changed since the groups were created. It is
                      recommended that the groups be regenerate to handle lineup changes. Any previous manual
                      groups will need to be recreated before pressing the Generate/Regenerate button.
                    </ThemedText>
                  )}
                  {currentRoundGroups.length > 0 && manualGroupList.length === 0 && (
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
                        {selectedGroupIndex !== null && (
                          <ThemedView style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                            <Pressable onPress={() => modifyGroup()}>
                              <Entypo name="edit" size={24} color={iconButton} />
                            </Pressable>
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
                  {manualGroupList.length > 0 && (
                    <ThemedView style={{ paddingTop: 10, flex: 1 }}>
                      <ThemedView>
                        <ThemedText type="subtitle">Manual Tee Groups</ThemedText>
                        <ThemedText style={{ color: errorText, paddingBottom: 10 }} type="default">
                          Press Generate to build groups that include the remaining players.
                        </ThemedText>
                      </ThemedView>
                      <ThemedView style={{ flex: 1 }}>
                        <FlatList
                          data={manualGroupsPlayersNames}
                          keyExtractor={(index) => `${index}`}
                          renderItem={renderManualGroup}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
