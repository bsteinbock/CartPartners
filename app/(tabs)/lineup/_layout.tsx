import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Line-up', headerShown: false }} />
      <Stack.Screen name="players" options={{ title: 'Define Players', headerShown: false }} />
    </Stack>
  );
}
