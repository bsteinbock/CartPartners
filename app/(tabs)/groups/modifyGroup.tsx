import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import SwipeableGroupPlayer from '@/components/ui/SwipeableGroupPlayer';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getGroupPlayerIdsByRoundId, getPlayerForGroup } from '@/lib/cart-utils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { FlatList, Pressable } from 'react-native-gesture-handler';

export default function ModifyGroup() {
  const { groupId } = useLocalSearchParams();
  const numericGroupId = Number(groupId ?? '0');
  const router = useRouter();
  const {
    groupPlayers,
    updateGroupPlayers,
    roundPlayers,
    all_players,
    league_players,
    groups,
    currentRoundId,
  } = useDbStore();
  const [currentGroupPlayers, setCurrentGroupPlayers] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const [isPlayerPickerVisible, setIsPlayerPickerVisible] = useState<boolean>(false);
  const [playerOptions, setPlayerOptions] = useState<OptionEntry[]>([]);

  useEffect(() => {
    // get group from groupId and load
    const group = groupPlayers.find((g) => g.group_id === Number(groupId));
    if (group) {
      const memberPlayers = getPlayerForGroup(group.player_ids, all_players);
      setCurrentGroupPlayers(memberPlayers);
    }
  }, [groupId, groupPlayers, all_players]);

  useEffect(() => {
    // get a list of all player ids in all groups of the current round
    if (currentRoundId) {
      const groupPlayerIds = getGroupPlayerIdsByRoundId(currentRoundId, groups, groupPlayers);

      // now get a list of players that are marked as available but not in the list of groupPlayerIds.
      const available = league_players.filter((p) => !groupPlayerIds.includes(p.id));
      setAvailablePlayers(available);
    }
  }, [groupPlayers, league_players, currentRoundId, groups]);

  useEffect(() => {
    const availableOptions = availablePlayers.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setPlayerOptions([]);
    } else {
      setPlayerOptions(availableOptions);
    }
  }, [availablePlayers]);

  const currentGroupPlayerIds = useMemo(() => {
    return currentGroupPlayers.map((p) => p.id);
  }, [currentGroupPlayers]);

  const handlePlayerOptionChange = useCallback(
    (option: OptionEntry) => {
      const playerToAdd = league_players.find((p) => p.id === option.value);
      if (playerToAdd) {
        const updatedPlayers = [...currentGroupPlayers, playerToAdd];
        const updatedPlayerIds = updatedPlayers.map((p) => p.id);
        updateGroupPlayers(numericGroupId, updatedPlayerIds);
        setIsPlayerPickerVisible(false);
      }
    },
    [currentGroupPlayers, numericGroupId, league_players, updateGroupPlayers],
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Modify Group',
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '500',
          },
        }}
      />
      <ThemedView style={{ flex: 1, padding: 12 }}>
        <ThemedView
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 12,
          }}
        >
          <ThemedText type="title">Group Players</ThemedText>
          {currentGroupPlayers.length < 4 && playerOptions.length > 0 && (
            <ThemedView>
              <Pressable onPress={() => setIsPlayerPickerVisible(true)}>
                <MaterialIcons name="person-add" size={28} color={iconButton} />
              </Pressable>
            </ThemedView>
          )}
        </ThemedView>
        <FlatList
          data={currentGroupPlayers}
          renderItem={(item) => (
            <SwipeableGroupPlayer
              groupId={numericGroupId}
              player={item.item}
              groupPlayerIds={currentGroupPlayerIds}
            />
          )}
          keyExtractor={(item) => `${item.id}`}
          style={styles.list}
        />
      </ThemedView>
      {playerOptions && isPlayerPickerVisible && (
        <BottomSheetContainer
          isVisible={isPlayerPickerVisible}
          title="Select Player"
          modalHeight="50%"
          onClose={() => setIsPlayerPickerVisible(false)}
        >
          <OptionList options={playerOptions} onSelect={(option) => handlePlayerOptionChange(option)} />
        </BottomSheetContainer>
      )}
    </ThemedView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    flex: 1,
  },
});
