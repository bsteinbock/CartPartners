import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer>
      <Drawer.Screen name="message" options={{ title: 'Message Players' }} />
      <Drawer.Screen name="leagues" options={{ title: 'Leagues / Outings' }} />
      <Drawer.Screen name="about" options={{ title: 'About' }} />
      <Drawer.Screen name="backup" options={{ title: 'Backup/Restore' }} />
      <Drawer.Screen name="players" options={{ title: 'Manage Players' }} />
    </Drawer>
  );
}
