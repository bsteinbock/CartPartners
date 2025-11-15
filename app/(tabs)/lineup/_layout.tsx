import { Stack, usePathname } from 'expo-router';
export default function Layout() {
  const pathname = usePathname();
  return (
    <Stack
      screenOptions={{
        animation: pathname.startsWith('lineup') ? 'default' : 'none',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Lineup', headerShown: false }} />
      <Stack.Screen name="players" options={{ title: 'League Players', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Define Player', headerShown: true }} />
    </Stack>
  );
}
