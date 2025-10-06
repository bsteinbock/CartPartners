import { Tabs } from 'expo-router';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarShowLabel: true,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="players/index"
          options={{
            title: 'Players',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="rounds/index"
          options={{
            title: 'Rounds',
            tabBarLabel: 'Rounds',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />
        {/* hide rounds detail route from the tab bar */}
        <Tabs.Screen
          name="rounds/[id]"
          options={{
          href: null,
          }}
        />
        {/* hide the player editor route from the tab bar while keeping it in this route group */}
        <Tabs.Screen
          name="player/[id]"
          options={{
               href: null,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
