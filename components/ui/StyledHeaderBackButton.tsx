import { useThemeColor } from '@/hooks/use-theme-color';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

export const StyledHeaderBackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} hitSlop={10} style={styles.backButton}>
      <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={iconColor} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backButton: {
    // Apply negative left margin to align with expo-router's default header positioning
    marginLeft: Platform.OS === 'ios' ? 0 : -4,
  },
});
