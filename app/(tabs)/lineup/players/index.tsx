import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, Button, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

export default function PlayersScreen() {
  const router = useRouter();
  const { players, addPlayers, updatePlayer } = useDbStore();

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/lineup/players/${id}`);
  };

  const addNewPlayer = () => {
    router.push({ pathname: `/lineup/players/[id]`, params: { id: 'new' } });
  };

  const toggleAvailable = (p: Player) => {
    try {
      if (!p.id) return;
      updatePlayer(p.id, { available: p.available ? 0 : 1 });
    } catch (e) {
      console.warn('Toggle available failed', e);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const exportToCSV = async () => {
    if (!players || players.length === 0) {
      Alert.alert('No data', 'There are no players to export.');
      return;
    }

    try {
      const header = ['Name', 'Speed Index', 'Email', 'Available'];
      const rows = players.map((p) => [
        `"${p.name}"`,
        p.speedIndex,
        `"${p.email ?? ''}"`,
        p.available ? 'Yes' : 'No',
      ]);

      const csvString = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const file = new File(Paths.cache, 'players.csv');
      file.create({ overwrite: true });
      file.write(csvString);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'This device does not support sharing files.');
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Players CSV',
      });
    } catch (err) {
      console.error('Error exporting CSV', err);
      Alert.alert('Error', 'Failed to export players.');
    }
  };

  const importFromCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const csvFile = new File(fileUri);

      const fileContent = await csvFile.text();

      // Split into lines and parse CSV
      const lines = fileContent.trim().split('\n');
      const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
      const nameIndex = header.findIndex((h) => h.toLowerCase() === 'name');
      const speedIndexIdx = header.findIndex((h) => h.toLowerCase().includes('speed'));
      const emailIndex = header.findIndex((h) => h.toLowerCase() === 'email');
      const availableIndex = header.findIndex((h) => h.toLowerCase().includes('available'));

      if (nameIndex === -1) {
        Alert.alert('Invalid CSV', 'The CSV must contain a "Name" column.');
        return;
      }

      let newPlayers: Omit<Player, 'id'>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((v) => v.replace(/"/g, '').trim());
        if (!cols[nameIndex]) continue;

        const name = cols[nameIndex];
        const speedIndex = parseInt(cols[speedIndexIdx]) || 1;
        const email = cols[emailIndex] || '';
        const available =
          (cols[availableIndex] || '').toLowerCase().startsWith('y') ||
          (cols[availableIndex] || '').toLowerCase() === 'true'
            ? 1
            : 0;

        // Check if player exists by name (case-insensitive)
        const existing = players.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());

        if (existing && existing.id) {
          updatePlayer(existing.id, { speedIndex, email, available });
        } else {
          newPlayers.push({ name, speedIndex, email, available });
        }
      }

      if (newPlayers.length > 0) {
        addPlayers(newPlayers);
      }

      Alert.alert('Import complete', `${newPlayers.length}Players imported successfully!`);
    } catch (err) {
      console.error('Import failed', err);
      Alert.alert('Error', 'Failed to import players.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 10,
          }}
        >
          <ThemedText type="title">Players</ThemedText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {players.length === 0 && <Button title="Import" onPress={importFromCSV} />}
            {players.length > 0 && <Button title="Export" onPress={exportToCSV} />}
            <Button title="Add" onPress={addNewPlayer} />
          </View>
        </View>

        <FlatList
          data={players}
          keyExtractor={(item, i) => String(item.id ?? i)}
          ListHeaderComponent={() => (
            <ThemedView
              style={{
                padding: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: 1,
                borderColor: '#ddd',
              }}
            >
              <ThemedText style={{ fontWeight: '700' }}>Name</ThemedText>
              <ThemedText style={{ fontWeight: '700', textAlign: 'right', flex: 1, paddingRight: 20 }}>
                Available
              </ThemedText>
            </ThemedView>
          )}
          renderItem={({ item }) => (
            <View
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderColor: '#eee',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Pressable onPress={() => startEdit(item.id)}>
                  <View>
                    <ThemedText>{item.name}</ThemedText>
                    <ThemedText style={{ color: '#666' }}>{`Speed: ${item.speedIndex}`}</ThemedText>
                    <ThemedText numberOfLines={2} style={{ color: '#666' }}>{`Email: ${
                      item.email ?? 'not specified'
                    }`}</ThemedText>
                  </View>
                </Pressable>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Switch value={!!item.available} onValueChange={() => toggleAvailable(item)} />
              </View>
            </View>
          )}
        />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
