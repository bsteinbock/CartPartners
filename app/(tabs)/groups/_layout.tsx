import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Groups', headerShown: false }} />
      <Stack.Screen name="setGroupCoordinator" options={{ title: 'Group Coordinator' }} />
    </Stack>
  );
}
