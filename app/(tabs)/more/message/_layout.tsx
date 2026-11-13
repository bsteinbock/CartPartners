import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack screenOptions={{ headerTransparent: false }}>
      <Stack.Screen name="index" options={{ title: 'Notify Players', headerShown: false }} />
    </Stack>
  );
}
