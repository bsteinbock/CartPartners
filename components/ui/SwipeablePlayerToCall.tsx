import { Player } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Alert, Linking, StyleSheet } from 'react-native';
import { Pressable, Switch } from 'react-native-gesture-handler';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { SwipeableComponent } from './SwipeableComponent';

const RIGHT_ACTION_WIDTH = 86;
const SWIPE_THRESHOLD_WIDTH = 50;

const SwipeablePlayerToCall = ({
  player,
  isSelected,
  onToggle,
  switchTrackColor,
}: {
  player: Player;
  isSelected: boolean;
  onToggle: (playerId: number) => void;
  switchTrackColor: string;
}) => {
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const roundRef = useRef<any>(null);

  const hasMobileNumber = !!player.mobile_number?.trim();

  const callPlayer = async () => {
    if (!hasMobileNumber) return;

    const telUrl = `tel:${player.mobile_number.trim()}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert('Unable to Call', 'Your device cannot open the phone app for this number.');
      return;
    }

    try {
      await Linking.openURL(telUrl);
      roundRef?.current?.close();
    } catch {
      Alert.alert('Unable to Call', 'Could not open the phone app.');
    }
  };

  const RightAction = () => {
    return (
      <Pressable style={styles.rightAction} onPress={() => void callPlayer()}>
        <Ionicons name="call" size={22} color="white" />
      </Pressable>
    );
  };

  return (
    <SwipeableComponent
      key={player.id}
      threshold={SWIPE_THRESHOLD_WIDTH}
      actionWidth={RIGHT_ACTION_WIDTH}
      renderRightActions={hasMobileNumber ? RightAction : undefined}
      ref={roundRef}
    >
      <ThemedView style={[styles.itemEntry, { borderColor, borderBottomWidth: 1 }]}>
        <ThemedView style={styles.itemInfo}>
          <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch
              trackColor={{ true: switchTrackColor }}
              value={isSelected}
              onValueChange={() => onToggle(player.id)}
            />
            <ThemedText style={{ marginLeft: 30 }}>{player.name}</ThemedText>
          </ThemedView>
          {hasMobileNumber && <MaterialIcons name="chevron-right" size={24} color={iconColor} />}
        </ThemedView>
      </ThemedView>
    </SwipeableComponent>
  );
};

const styles = StyleSheet.create({
  itemInfo: {
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  itemEntry: {
    width: '100%',
    paddingHorizontal: 2,
  },
  rightAction: {
    width: 96,
    minHeight: 48,
    backgroundColor: '#2e8b57',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SwipeablePlayerToCall;
