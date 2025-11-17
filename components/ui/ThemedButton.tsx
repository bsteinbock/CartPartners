import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '../themed-text';

interface ThemedButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  color?: string;
  disabled?: boolean;
}

const ThemedButton: React.FC<ThemedButtonProps> = ({ title, onPress, disabled = false, color }) => {
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');
  const textColor = color ? color : iconButton;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed]}
    >
      <ThemedText style={[styles.text, { color: disabled ? textDim : textColor }]}>{title}</ThemedText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8, // Visual feedback when pressed
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ThemedButton;
