import { deleteBackgroundColor } from '@/constants/theme';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { SwipeableComponent } from './SwipeableComponent';

const RIGHT_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD_WIDTH = 50;

const SwipeableGroupPlayer = ({
  groupId,
  player,
  groupPlayerIds,
}: {
  groupId: number;
  player: Player;
  groupPlayerIds: number[];
}) => {
  const { updateGroupPlayers } = useDbStore();
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');

  const deletePlayer = useCallback(
    (playerId: number) => {
      const updatedPlayerIds = groupPlayerIds.filter((id) => id !== playerId);
      updateGroupPlayers(groupId, updatedPlayerIds);
    },
    [groupId, groupPlayerIds, updateGroupPlayers],
  );

  const handleDelete = useCallback(
    (player: Player) => {
      Alert.alert(
        'Remove Player',
        'Are you sure you want to remover the player from the group?',
        [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deletePlayer(player.id) }],
        { cancelable: true },
      );
    },
    [deletePlayer],
  );

  const RightAction = () => {
    return (
      <Pressable
        style={styles.rightAction}
        onPress={() => {
          handleDelete(player);
        }}
      >
        <MaterialIcons name="delete" size={24} color="white" />
      </Pressable>
    );
  };

  const roundRef = useRef<any>(null);

  return (
    <SwipeableComponent
      key={player.id}
      threshold={SWIPE_THRESHOLD_WIDTH}
      actionWidth={RIGHT_ACTION_WIDTH}
      renderRightActions={RightAction}
      ref={roundRef}
    >
      <ThemedView style={[styles.itemEntry, { borderColor, borderBottomWidth: 1 }]}>
        <ThemedView style={styles.itemInfo}>
          <ThemedView>
            <ThemedText>{player.name}</ThemedText>
          </ThemedView>
          <MaterialIcons name="chevron-right" size={24} color={iconColor} />
        </ThemedView>
      </ThemedView>
    </SwipeableComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 50,
  },

  itemEntry: {
    width: '100%',
    paddingHorizontal: 10,
  },
  itemName: {
    flex: 1,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    marginRight: 10,
  },

  itemAmount: {
    textAlign: 'right',
    width: 80,
    marginRight: 30,
  },

  rightAction: {
    width: 100,
    height: 50,
    backgroundColor: deleteBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SwipeableGroupPlayer;
