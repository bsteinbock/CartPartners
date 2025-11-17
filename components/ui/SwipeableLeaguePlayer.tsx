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

const SwipeableLeaguePlayerItem = ({
  player,
  onPress,
  onDelete,
}: {
  player: Player;
  onPress?: () => void;
  onDelete?: (player: Player) => void;
}) => {
  const { removePlayerFromLeague, currentLeagueId, leagues } = useDbStore();
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');
  const league = leagues.find((l) => l.id === currentLeagueId);

  const handleDelete = useCallback(
    (player: Player) => {
      Alert.alert(
        'Delete Player',
        `Are you sure you want to delete ${player.name}? This action cannot be undone. It
         will remove the player from the league ${league?.name}.`,
        [
          { text: 'Cancel' },
          { text: 'Delete', onPress: () => removePlayerFromLeague(player.id, league?.id ?? 0) },
        ],
        { cancelable: true },
      );
    },
    [removePlayerFromLeague, league],
  );

  const openEdit = (p: Player) => {
    if (onPress) {
      onPress();
      return;
    }
  };

  const RightAction = () => {
    return (
      <Pressable
        style={styles.rightAction}
        onPress={() => {
          if (onDelete) {
            onDelete(player);
            return;
          }
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
        <Pressable
          onPress={() => {
            roundRef?.current.close();
            openEdit(player);
          }}
        >
          <ThemedView style={styles.itemInfo}>
            <ThemedView>
              <ThemedText>{`${player.name}`}</ThemedText>
              <ThemedText type="small">{`${player.email || 'No Email'}`}</ThemedText>
            </ThemedView>
            <ThemedView style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <MaterialIcons name="chevron-right" size={24} color={iconColor} />
            </ThemedView>
          </ThemedView>
        </Pressable>
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
    height: 60,
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
    height: 60,
    backgroundColor: deleteBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SwipeableLeaguePlayerItem;
