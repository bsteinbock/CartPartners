import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack screenOptions={{ headerBackTitle: '', headerBackButtonDisplayMode: 'minimal', headerTransparent: false }}>
      <Stack.Screen name="index" options={{ title: 'Groups', headerShown: false }} />
    </Stack>
  );
}
