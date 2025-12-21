import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDb, useDbStore } from '@/hooks/use-dbStore';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const refreshAll = useDbStore((s) => s.refreshAll);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDatabase = async () => {
      try {
        initDb(); // ensures DB and tables exist
        refreshAll(); // load initial data
      } catch (error) {
        console.error('Database initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDatabase();
  }, [refreshAll]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#fff' : '#000'} />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <GestureHandlerRootView>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="setGroupCoordinator"
                options={{ presentation: 'modal', title: 'Group Coordinator' }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});
