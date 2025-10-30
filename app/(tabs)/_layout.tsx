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
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
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
            title: 'Line-up',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="figure.golf" color={color} />,
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
          name="about"
          options={{
            title: 'About',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="info.circle" color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
