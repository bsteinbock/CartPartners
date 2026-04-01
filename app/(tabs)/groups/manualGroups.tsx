import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import MultiSelectOptionList from '@/components/ui/MultiSelectOptionList';
import { OptionEntry } from '@/components/ui/OptionList';
import { StyledHeaderBackButton } from '@/components/ui/StyledHeaderBackButton';
import ThemedButton from '@/components/ui/ThemedButton';
import { ManualGroupList, Player, RoundPlayer, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  buildPlayingPartnerFrequencies,
  formatManualGroupPlayersByNames,
  generateGroupsForRound,
  getGroupSizes,
} from '@/lib/cart-utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

export default function DefineManualGroups() {
  const {
    roundPlayers,
    currentRoundId,
    setManualGroupList,
    manualGroupList,
    league_players,
    setGroupsForRound,
    groupPlayers,
    all_players,
  } = useDbStore();
  const [availablePlayerIds, setAvailablePlayerIds] = useState<RoundPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);
  const [selectedPlayerOptions, setSelectedPlayerOptions] = useState<OptionEntry[]>([]);
  const [manualGroups, setManualGroups] = useState<ManualGroupList[]>([]);
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const errorText = useThemeColor({ light: undefined, dark: undefined }, 'errorText');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const [manualGroupsPlayersNames, setManualGroupsPlayersNames] = useState<string[]>([]);
  const currentGroupSize = useMemo(() => getGroupSizes(availablePlayers.length)[0] ?? 0, [availablePlayers]);
  const [useNickname, setUseNickname] = useState<boolean>(false);
  const [selectedManualGroupIndex, setSelectedManualGroupIndex] = useState<number | null>(null);

  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const stored = await SecureStore.getItemAsync('cartPartnerUseNickname');
        if (isActive) setUseNickname(stored === 'true');
      })();
      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    setManualGroups([...manualGroupList]);
  }, [manualGroupList]);

  useEffect(() => {
    const manualGroupPlayerIds = manualGroups.flat().flat();
    const possiblePlayer = roundPlayers
      .filter((p) => p.round_id === currentRoundId)
      .filter((rp) => !manualGroupPlayerIds.includes(rp.player_id));
    setAvailablePlayerIds(possiblePlayer);
  }, [roundPlayers, currentRoundId, manualGroups]);

  useEffect(() => {
    const currentRoundPlayers = availablePlayerIds
      .map((ap) => league_players.find((p) => p.id === ap.player_id))
      .filter((e) => e !== undefined);
    setAvailablePlayers(currentRoundPlayers);
  }, [availablePlayerIds, league_players]);

  useEffect(() => {
    const options = availablePlayers.map((p) => ({
      label: useNickname && p.nickname ? p.nickname : p.name,
      value: p.id,
    }));
    setPlayerOptions(options);
  }, [availablePlayers, useNickname]);

  useEffect(() => {
    if (manualGroups.length > 0) {
      const names = formatManualGroupPlayersByNames(manualGroups, league_players);
      setManualGroupsPlayersNames(names);
    } else {
      setManualGroupsPlayersNames([]);
    }

    if (selectedManualGroupIndex !== null && selectedManualGroupIndex >= manualGroups.length) {
      setSelectedManualGroupIndex(null);
    }
  }, [manualGroups, league_players, selectedManualGroupIndex]);

  const removeSelectedManualGroup = () => {
    if (selectedManualGroupIndex === null) return;

    setManualGroups((prev) => prev.filter((_, index) => index !== selectedManualGroupIndex));
    setSelectedManualGroupIndex(null);
  };

  const saveGroupFromSelection = (selectedIds: number[]) => {
    if (selectedIds.length < 2 || selectedIds.length > currentGroupSize) {
      Alert.alert('Invalid Group', `Please select between 2 and ${currentGroupSize} players`);
      return;
    }

    setManualGroups((prev) => [...prev, selectedIds]);
    setAvailablePlayerIds((prev) => prev.filter((ap) => !selectedIds.includes(ap.player_id)));
    setSelectedPlayers([]);
    setSelectedPlayerOptions([]);
  };

  const handlePlayerOptionChange = (option: OptionEntry) => {
    setSelectedPlayerOptions((prev) => {
      const exists = prev.find((o) => o.value === option.value);
      let next = prev;

      if (exists) {
        next = prev.filter((o) => o.value !== option.value);
      } else {
        if (prev.length >= currentGroupSize) {
          Alert.alert('Group Full', `You can select up to ${currentGroupSize} players per group`);
          return prev;
        }
        next = [...prev, option];
      }

      const selectedIds = next.map((o) => o.value ?? null).filter((v): v is number => v !== null);
      setSelectedPlayers(selectedIds);

      if (selectedIds.length === currentGroupSize) {
        saveGroupFromSelection(selectedIds);
        setIsPlayerPickerVisible(false);
        return [];
      }

      return next;
    });
  };

  const finishGrouping = useCallback(() => {
    let finalGroupList: ManualGroupList[] = [...manualGroups];

    if (availablePlayers.length > 0) {
      // Generate groups for remaining available players
      const remainingPlayerIds = availablePlayers.map((p) => p.id);
      const partnerFrequencies = buildPlayingPartnerFrequencies(remainingPlayerIds, groupPlayers);
      const generatedGroups = generateGroupsForRound({
        playerIds: remainingPlayerIds,
        partnerFrequencies,
        allPlayers: all_players,
      });
      finalGroupList = [...manualGroups, ...generatedGroups];
    }

    // Save all groups (manual + generated) to database
    setGroupsForRound(currentRoundId!, finalGroupList);
    setManualGroupList([]);
    setManualGroups([]);
    router.back();
  }, [
    availablePlayers,
    currentRoundId,
    manualGroups,
    setGroupsForRound,
    setManualGroupList,
    router,
    groupPlayers,
    all_players,
  ]);

  const cancelGrouping = () => {
    if (manualGroups.length > 0) {
      Alert.alert('Manual Groups Incomplete', 'Do you want to cancel? All unsaved groups will be lost.', [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const handleBackPress = useCallback(() => {
    if (manualGroups.length > 0) {
      Alert.alert('Manual Groups', 'Are you done setting manual groups?.', [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            finishGrouping();
          },
        },
      ]);
      return;
    }
    router.back();
  }, [router, manualGroups, finishGrouping]);

  // Render each group in the FlatList
  const renderManualGroup = ({ item, index }: { item: string; index: number }) => {
    const isSelected = selectedManualGroupIndex === index;

    return (
      <Pressable
        onPress={() => setSelectedManualGroupIndex((prev) => (prev === index ? null : index))}
        style={{ marginBottom: 8 }}
      >
        <ThemedView
          style={[
            styles.groupCard,
            {
              backgroundColor: backgroundColor,
              borderColor: isSelected ? iconButton : borderColor,
              shadowColor: borderColor,
              shadowOpacity: isSelected ? 0.12 : 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ fontWeight: '600' }}>{`${item}`}</ThemedText>
          </ThemedView>
        </ThemedView>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Manual Groups',
          gestureEnabled: false,
          headerLeft: () => <StyledHeaderBackButton onPress={handleBackPress} />,

          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '500',
          },
        }}
      />
      {currentGroupSize > 0 ? (
        <ThemedView>
          <ThemedView
            style={{
              margin: 10,
              borderColor: currentGroupSize === 0 || availablePlayers.length < 2 ? disabledColor : iconButton,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton
              title={`Select Players for Group ${manualGroups.length + 1}`}
              onPress={() => setIsPlayerPickerVisible(true)}
              disabled={currentGroupSize === 0 || availablePlayers.length < 2}
            />
          </ThemedView>
        </ThemedView>
      ) : (
        <ThemedText type="default" style={styles.header}>
          All players have been assigned to a group. Press finish to use these group or Cancel to discard
          groups and return to screen to generate groups.
        </ThemedText>
      )}

      <ThemedView style={{ flex: 1, marginTop: 16 }}>
        {manualGroups.length > 0 && (
          <ThemedView style={{ paddingTop: 10, flex: 1 }}>
            <ThemedView
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <ThemedText type="subtitle">Manual Tee Groups</ThemedText>
              {selectedManualGroupIndex !== null && (
                <Pressable onPress={removeSelectedManualGroup} hitSlop={8}>
                  <Ionicons name="trash-outline" size={22} color={errorText} />
                </Pressable>
              )}
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

        <View style={styles.buttonContainer}>
          <ThemedView
            style={{
              margin: 10,
              borderColor: manualGroups.length === 0 ? disabledColor : iconButton,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton title="Finish" onPress={finishGrouping} disabled={manualGroups.length === 0} />
          </ThemedView>
          <ThemedView style={{ margin: 10, borderColor: iconButton, borderWidth: 1, borderRadius: 6 }}>
            <ThemedButton title="Cancel" onPress={cancelGrouping} />
          </ThemedView>
        </View>
      </ThemedView>

      {isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title={`Select up to ${currentGroupSize} players`}
          modalHeight="70%"
          okLabel="Done"
          okDisabled={selectedPlayers.length < 2 || selectedPlayers.length > currentGroupSize}
          onOK={() => {
            saveGroupFromSelection(selectedPlayers);
            setIsPlayerPickerVisible(false);
          }}
          onClose={() => setIsPlayerPickerVisible(false)}
        >
          <MultiSelectOptionList
            options={playerOptions}
            selectedOptions={selectedPlayerOptions}
            onSelect={handlePlayerOptionChange}
          />
        </BottomSheetContainer>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  subheader: {
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
