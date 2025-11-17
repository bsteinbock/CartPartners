import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'All Players', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Define Player', headerShown: true }} />
    </Stack>
  );
}
