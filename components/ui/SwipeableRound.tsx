import { deleteBackgroundColor } from '@/constants/theme';
import { Round, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDate } from '@/lib/formatters';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { SwipeableComponent } from './SwipeableComponent';

const RIGHT_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD_WIDTH = 50;

const SwipeableRoundItem = ({ round }: { round: Round }) => {
  const router = useRouter();
  const { roundSummaries, setCurrentRoundId, deleteRound } = useDbStore();
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');

  const handleDelete = useCallback(
    (itemId: number) => {
      Alert.alert(
        'Delete Round',
        'Are you sure you want to delete this round?',
        [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deleteRound(itemId) }],
        { cancelable: true },
      );
    },
    [deleteRound],
  );

  const setLineUp = (r: any) => {
    if (r && typeof r.id !== 'undefined') {
      setCurrentRoundId(r.id);
      router.replace({ pathname: '/lineup' });
    }
  };

  const openEdit = (r: any) => {
    if (r && typeof r.id !== 'undefined') {
      router.push({ pathname: '/edit-or-add', params: { id: String(r.id) } });
    }
  };

  const RightAction = () => {
    return (
      <Pressable
        style={styles.rightAction}
        onPress={() => {
          handleDelete(round.id);
        }}
      >
        <MaterialIcons name="delete" size={24} color="white" />
      </Pressable>
    );
  };

  const roundRef = useRef<any>(null);

  return (
    <SwipeableComponent
      key={round.id}
      threshold={SWIPE_THRESHOLD_WIDTH}
      actionWidth={RIGHT_ACTION_WIDTH}
      renderRightActions={RightAction}
      ref={roundRef}
    >
      <ThemedView style={[styles.itemEntry, { borderColor, borderBottomWidth: 1 }]}>
        <Pressable
          onLongPress={() => {
            roundRef?.current.close();
            openEdit(round);
          }}
          onPress={() => {
            roundRef?.current.close();
            setLineUp(round);
          }}
        >
          <ThemedView style={styles.itemInfo}>
            <ThemedView>
              <ThemedText>{`${round.course} (${formatDate(round.date)})`}</ThemedText>
              <ThemedText type="small">{`${
                roundSummaries.find((s) => s.round_id === round.id)?.numPlayers ?? 0
              } players`}</ThemedText>
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

export default SwipeableRoundItem;
