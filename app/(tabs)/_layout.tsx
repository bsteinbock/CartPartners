import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Platform } from 'react-native';

export default function TabLayout() {
  const tabIconDefault = useThemeColor({ light: undefined, dark: undefined }, 'tabIconDefault');
  const tabIconSelected = useThemeColor({ light: undefined, dark: undefined }, 'tabIconSelected');

  return (
    <Tabs
      screenOptions={{
        tabBarLabelStyle: {
          fontSize: Platform.OS === 'android' ? 15 : 16,
          fontWeight: '500',
        },
        tabBarStyle: {
          height: Platform.OS === 'android' ? 110 : 86,
          alignItems: 'center',
        },
        tabBarActiveTintColor: tabIconSelected,
        tabBarInactiveTintColor: tabIconDefault,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="(rounds)"
        options={{
          title: 'Rounds',
          tabBarLabel: 'Rounds',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lineup"
        options={{
          title: 'Lineup',
          popToTopOnBlur: true,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="figure.golf" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          popToTopOnBlur: true,
          title: 'Groups',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis" color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
