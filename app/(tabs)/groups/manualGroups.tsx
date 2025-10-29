import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ManualGroupList, Player, RoundPlayer, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getGroupSizes } from '@/lib/cart-utils';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Switch, View } from 'react-native';

export default function DefineManualGroups() {
  const { roundPlayers, currentRoundId, setManualGroupList, manualGroupList, players } = useDbStore();
  const [availablePlayerIds, setAvailablePlayerIds] = useState<RoundPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [manualGroups, setManualGroups] = useState<ManualGroupList[]>([]);
  const [groupSizes, setGroupSizes] = useState<number[]>([]);
  const [currentGroupSize, setCurrentGroupSize] = useState<number>(0);
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const router = useRouter();

  useEffect(() => {
    setManualGroups([...manualGroupList]);
  }, [manualGroupList]);

  useEffect(() => {
    setAvailablePlayerIds(roundPlayers.filter((p) => p.round_id === currentRoundId));
  }, [roundPlayers, currentRoundId]);

  useEffect(() => {
    const currentRoundPlayers = availablePlayerIds
      .map((ap) => players.find((p) => p.id === ap.player_id))
      .filter((e) => e !== undefined);
    setAvailablePlayers(currentRoundPlayers);
  }, [availablePlayerIds]);

  useEffect(() => {
    const groupSizes = getGroupSizes(availablePlayerIds.length);
    setGroupSizes(groupSizes);
  }, [availablePlayerIds]);

  useEffect(() => {
    const groupSize = manualGroups.length;
    setCurrentGroupSize(groupSizes[groupSize] || 0);
  }, [manualGroups]);

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
    setAvailablePlayers(availablePlayers.filter((p) => !selectedPlayers.includes(p.id)));
    setSelectedPlayers([]);
  };

  const finishGrouping = () => {
    if (availablePlayers.length > 0) {
      Alert.alert('Incomplete Groups', 'Please assign all players to groups');
      return;
    }
    //setManualGroups(groups);
    Alert.alert('Success', 'Manual groups have been saved');
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

  const renderPlayer = ({ item }: { item: Player }) => (
    <ThemedView style={[styles.playerRow, { borderBottomColor: borderColor, borderBottomWidth: 1 }]}>
      <Switch value={selectedPlayers.includes(item.id)} onValueChange={() => togglePlayer(item.id)} />
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

      <ThemedText type="default" style={styles.header}>
        You are allowed to define up to {groupSizes.length} manual groups for this round. The number of
        players per group will be specified.
      </ThemedText>

      <ThemedText style={styles.subheader}>
        Selected: {selectedPlayers.length}/{currentGroupSize} players
      </ThemedText>

      <FlatList
        data={availablePlayers}
        renderItem={renderPlayer}
        keyExtractor={(item) => `${item.id}`}
        style={styles.list}
      />

      <View>
        <Button
          title="Save Selected as Group"
          onPress={saveGroup}
          disabled={selectedPlayers.length !== currentGroupSize}
        />
        <View style={styles.buttonContainer}>
          <Button title="Finish" onPress={finishGrouping} disabled={manualGroups.length === 0} />
          <Button title="Cancel" onPress={cancelGrouping} />
        </View>
      </View>
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
});
