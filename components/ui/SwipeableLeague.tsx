import { deleteBackgroundColor } from '@/constants/theme';
import { League, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { SwipeableComponent } from './SwipeableComponent';

const RIGHT_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD_WIDTH = 50;

const SwipeableLeagueItem = ({ league, onPress }: { league: League; onPress: (league: League) => void }) => {
  const { leagues, deleteLeague } = useDbStore();
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');

  const handleDelete = (league: League) => {
    if (leagues.length <= 1) {
      Alert.alert('Cannot Delete League', 'At least one league must exist.');
      return;
    }
    Alert.alert(
      'Delete League',
      `Are you sure you want to delete the league "${league.name}" and ALL its rounds and players?`,
      [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deleteLeague(league.id) }],
      { cancelable: true },
    );
  };

  const RightAction = () => {
    return (
      <Pressable
        style={styles.rightAction}
        onPress={() => {
          handleDelete(league);
        }}
      >
        <MaterialIcons name="delete" size={24} color="white" />
      </Pressable>
    );
  };

  const roundRef = useRef<any>(null);

  return (
    <SwipeableComponent
      key={league.id}
      threshold={SWIPE_THRESHOLD_WIDTH}
      actionWidth={RIGHT_ACTION_WIDTH}
      renderRightActions={RightAction}
      ref={roundRef}
    >
      <ThemedView style={[styles.itemEntry, { borderColor, borderBottomWidth: 1 }]}>
        <Pressable
          onPress={() => {
            roundRef?.current.close();
            onPress(league);
          }}
        >
          <ThemedView style={styles.itemInfo}>
            <ThemedView>
              <ThemedText>{league.name}</ThemedText>
            </ThemedView>
            <MaterialIcons name="chevron-right" size={24} color={iconColor} />
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

export default SwipeableLeagueItem;
