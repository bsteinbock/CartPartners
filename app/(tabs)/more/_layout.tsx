import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer>
      <Drawer.Screen name="about" options={{ title: 'About' }} />
      <Drawer.Screen name="backup" options={{ title: 'Backup/Restore' }} />
      <Drawer.Screen name="message" options={{ title: 'Send Message' }} />
    </Drawer>
  );
}
