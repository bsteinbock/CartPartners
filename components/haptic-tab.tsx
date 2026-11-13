import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { type ComponentRef, useImperativeHandle, useRef } from 'react';
import { Pressable } from 'react-native';

export function HapticTab({ ref, ...props }: BottomTabBarButtonProps) {
  const pressableRef = useRef<ComponentRef<typeof Pressable>>(null);
  useImperativeHandle(ref, () => pressableRef.current);

  return (
    <Pressable
      {...props}
      ref={pressableRef}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
