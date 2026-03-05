import { deleteBackgroundColor } from '@/constants/theme';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Pressable, Switch } from 'react-native-gesture-handler';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { SwipeableComponent } from './SwipeableComponent';

const RIGHT_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD_WIDTH = 50;

const SwipeablePlayerItem = ({
  player,
  onPress,
  onDelete,
}: {
  player: Player;
  onPress?: () => void;
  onDelete?: (player: Player) => void;
}) => {
  const router = useRouter();
  const { removePlayerFromLeague, updatePlayer, currentLeagueId, leagues } = useDbStore();
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const league = leagues.find((l) => l.id === currentLeagueId);

  const handleDelete = (player: Player) => {
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
  };

  const openEdit = (p: Player) => {
    if (onPress) {
      onPress();
      return;
    }

    if (p && typeof p.id !== 'undefined') {
      router.push({ pathname: '/more/players/[id]', params: { id: String(p.id) } });
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

  const toggleAvailable = (p: Player) => {
    try {
      if (!p.id) return;
      updatePlayer(p.id, { available: p.available ? 0 : 1 });
    } catch (e) {
      console.warn('Toggle available failed', e);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

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
              <Switch
                trackColor={{ true: switchTrackColor }}
                value={!!player.available}
                onValueChange={() => toggleAvailable(player)}
              />
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

export default SwipeablePlayerItem;
