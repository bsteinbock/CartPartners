import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Line-up', headerShown: false }} />
      <Stack.Screen name="players" options={{ title: 'Manage Players', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Define Player', headerShown: true }} />
    </Stack>
  );
}
