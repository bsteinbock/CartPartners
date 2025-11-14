import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { ManualGroupList, Player, RoundPlayer, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatManualGroupPlayersByNames, getGroupSizes } from '@/lib/cart-utils';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Switch, View } from 'react-native';

export default function DefineManualGroups() {
  const {
    roundPlayers,
    currentRoundId,
    setManualGroupList,
    manualGroupList,
    league_players,
    setGroupsForRound,
  } = useDbStore();
  const [availablePlayerIds, setAvailablePlayerIds] = useState<RoundPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [manualGroups, setManualGroups] = useState<ManualGroupList[]>([]);
  const [groupSizes, setGroupSizes] = useState<number[]>([]);
  const [currentGroupSize, setCurrentGroupSize] = useState<number>(0);
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');
  const backgroundColor = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const [manualGroupsPlayersNames, setManualGroupsPlayersNames] = useState<string[]>([]);

  const router = useRouter();

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
  }, [availablePlayerIds, players]);

  useEffect(() => {
    const groupSizes = getGroupSizes(availablePlayerIds.length);
    setGroupSizes(groupSizes);
  }, [availablePlayerIds, players]);

  useEffect(() => {
    // since we remove the available players when they are added to manual group we should always choose the first group size
    setCurrentGroupSize(groupSizes[0] || 0);
  }, [manualGroups, groupSizes]);

  useEffect(() => {
    if (manualGroups.length > 0) {
      const names = formatManualGroupPlayersByNames(manualGroups, players);
      setManualGroupsPlayersNames(names);
    }
  }, [manualGroups, players, formatManualGroupPlayersByNames]);

  const togglePlayer = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerId));
    } else if (selectedPlayers.length < currentGroupSize) {
      setSelectedPlayers([...selectedPlayers, playerId]);
    } else {
      Alert.alert('Group Full', `You can only select ${currentGroupSize} players per group`);
    }
  };

  const saveGroup = () => {
    if (selectedPlayers.length !== currentGroupSize) {
      Alert.alert('Invalid Group', `Please select exactly ${currentGroupSize} players`);
      return;
    }

    setManualGroups([...manualGroups, selectedPlayers]);
    setAvailablePlayerIds(availablePlayerIds.filter((ap) => !selectedPlayers.includes(ap.player_id)));
    setSelectedPlayers([]);
  };

  const finishGrouping = () => {
    if (availablePlayers.length === 0) {
      // if all players have been assigned to groups the we can save to database
      setGroupsForRound(currentRoundId!, manualGroups);
      setManualGroupList([]);
      setManualGroups([]);
    } else {
      // if manual groups does not include all players return to Groups tab so the remaining groups can be generated.
      setManualGroupList(manualGroups);
      setManualGroups([]);
    }
    router.back();
  };

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

  // Render each group in the FlatList
  const renderManualGroup = ({ item, index }: { item: string; index: number }) => {
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
          <ThemedText style={{ fontWeight: '600' }}>{`${item}`}</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <ThemedView style={[styles.playerRow, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}>
      <Switch
        trackColor={{ true: switchTrackColor }}
        value={selectedPlayers.includes(item.id)}
        onValueChange={() => togglePlayer(item.id)}
      />
      <ThemedText style={styles.playerName}>{item.name}</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Manual Groups',
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '500',
          },
        }}
      />
      {currentGroupSize > 0 ? (
        <ThemedView style={{ flex: 1 }}>
          <ThemedText style={styles.subheader}>
            Selected: {selectedPlayers.length}/{currentGroupSize} players
          </ThemedText>

          <FlatList
            data={availablePlayers}
            renderItem={renderPlayer}
            keyExtractor={(item) => `${item.id}`}
            style={styles.list}
          />
          <ThemedView
            style={{
              margin: 10,
              borderColor:
                selectedPlayers.length !== currentGroupSize || currentGroupSize === 0
                  ? disabledColor
                  : iconButton,
              borderWidth: 1,
              borderRadius: 6,
            }}
          >
            <ThemedButton
              title="Save Selected as Group"
              onPress={saveGroup}
              disabled={selectedPlayers.length !== currentGroupSize || currentGroupSize === 0}
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
            <ThemedView>
              <ThemedText type="subtitle">Manual Tee Groups</ThemedText>
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
  playerRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  playerName: {
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  groupCard: { padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
