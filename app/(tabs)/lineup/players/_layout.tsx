import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Define Players', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Define Player', headerShown: true }} />
    </Stack>
  );
}
