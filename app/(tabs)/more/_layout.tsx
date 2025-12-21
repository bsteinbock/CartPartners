import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer>
      <Drawer.Screen name="message" options={{ title: 'Notify Players' }} />
      <Drawer.Screen name="leagues" options={{ title: 'Leagues / Outings' }} />
      <Drawer.Screen name="leagueplayers" options={{ title: 'League Players' }} />
      <Drawer.Screen name="players" options={{ title: 'Manage All Players' }} />
      <Drawer.Screen name="backup" options={{ title: 'Backup/Restore' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="about" options={{ title: 'About' }} />
    </Drawer>
  );
}
