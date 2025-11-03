import React, { ReactNode, useImperativeHandle, forwardRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Add this interface for the ref
export interface SwipeableHandles {
  close: () => void;
}

// Update props interface
interface SwipeableProps {
  children: ReactNode;
  threshold: number;
  actionWidth: number;
  renderLeftActions?: () => ReactNode;
  renderRightActions?: () => ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

// Convert to forwardRef and add ref type
export const SwipeableComponent = forwardRef<SwipeableHandles, SwipeableProps>(
  (
    {
      children,
      threshold,
      actionWidth, // max visible translation
      renderLeftActions,
      renderRightActions,
      containerStyle,
    },
    ref,
  ) => {
    const translateX = useSharedValue(0);
    const gestureOffset = useSharedValue(0); // tracks full gesture
    const isOpen = useSharedValue(false);
    const openDirection = useSharedValue<'left' | 'right' | null>(null);
    const isHorizontal = useSharedValue(false);

    // Add close functionality
    const close = () => {
      translateX.value = withSpring(0);
      isOpen.value = false;
      openDirection.value = null;
      gestureOffset.value = 0;
    };

    // Expose the close method through the ref
    useImperativeHandle(ref, () => ({
      close,
    }));

    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10]) // Only activate after 10px horizontal movement
      .failOffsetY([-10, 10]) // Fail gesture if vertical movement exceeds 10px
      .onTouchesDown(() => {
        isHorizontal.value = false;
      })
      .onUpdate((event) => {
        if (isOpen.value) return; // prevent dragging open cell

        const dx = event.translationX;

        // If swiping right and no left actions → block
        if (dx > 0 && !renderLeftActions) {
          translateX.value = 0;
          return;
        }

        // If swiping left and no right actions → block
        if (dx < 0 && !renderRightActions) {
          translateX.value = 0;
          return;
        }

        gestureOffset.value = dx;
        translateX.value = clamp(dx, -actionWidth, actionWidth);
      })
      .onEnd(() => {
        if (gestureOffset.value > threshold) {
          // Swiped right
          if (renderLeftActions) {
            translateX.value = withSpring(actionWidth);
            isOpen.value = true;
            openDirection.value = 'right';
          }
        } else if (gestureOffset.value < -threshold) {
          // Swiped left
          if (renderRightActions) {
            translateX.value = withSpring(-actionWidth);
            isOpen.value = true;
            openDirection.value = 'left';
          }
        } else {
          // Not far enough — reset
          translateX.value = withSpring(0);
          isOpen.value = false;
          openDirection.value = null;
        }
        gestureOffset.value = 0;
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const leftActionStyle = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [0, 20], [0, 1], 'clamp'),
    }));

    const rightActionStyle = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [0, -20], [0, 1], 'clamp'),
    }));

    return (
      <View style={[styles.root, containerStyle]}>
        {/* Background Actions */}
        <View style={styles.backgroundContainer}>
          <Animated.View style={[styles.leftAction, leftActionStyle, { width: actionWidth }]}>
            {renderLeftActions?.()}
          </Animated.View>
          <View style={{ flex: 1 }}></View>
          <Animated.View style={[styles.rightAction, rightActionStyle, { width: actionWidth }]}>
            {renderRightActions?.()}
          </Animated.View>
        </View>

        {/* Foreground Swipeable Content */}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.foreground, animatedStyle]}>{children}</Animated.View>
        </GestureDetector>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftAction: {
    justifyContent: 'center',
    paddingLeft: 0,
    alignItems: 'center',
  },
  rightAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 0,
  },
  foreground: {
    width: '100%',
  },
});
