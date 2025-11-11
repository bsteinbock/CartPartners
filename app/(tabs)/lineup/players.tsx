import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164 } from '@/lib/cart-utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

export default function PlayersScreen() {
  const router = useRouter();
  const { players, addPlayers, updatePlayer, currentLeagueId } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');

  const startEdit = (id?: number) => {
    if (typeof id === 'undefined') return;
    router.push(`/lineup/${id}`);
  };

  const addNewPlayer = () => {
    router.push({ pathname: `/lineup/[id]`, params: { id: 'new' } });
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
      const header = ['Name', 'Nickname', 'Speed Index', 'Email', 'Mobile Number', 'Available'];
      const rows = players.map((p) => [
        `"${p.name}"`,
        `"${p.nickname || ''}"`,
        p.speedIndex,
        `"${p.email ?? ''}"`,
        `"${displayPhoneNumberFromE164(p.mobile_number) ?? ''}"`,
        p.available ? 'Yes' : 'No',
      ]);

      const csvString = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const file = new File(Paths.cache, 'cartpartners-players.csv');
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
      const nicknameIndex = header.findIndex((h) => h.toLowerCase() === 'nickname');
      const mobileNumberIndex = header.findIndex((h) => h.toLowerCase() === 'mobile_number');
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
        const nickname = cols[nicknameIndex] || '';
        const mobile_number = displayPhoneNumberFromE164(cols[mobileNumberIndex]) || '';
        const available =
          (cols[availableIndex] || '').toLowerCase().startsWith('y') ||
          (cols[availableIndex] || '').toLowerCase() === 'true'
            ? 1
            : 0;

        // Check if player exists by name (case-insensitive)
        const existing = players.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());

        if (existing && existing.id) {
          updatePlayer(existing.id, { speedIndex, email, available, nickname, mobile_number });
        } else {
          newPlayers.push({ name, speedIndex, email, available, nickname, mobile_number });
        }
      }

      if (newPlayers.length > 0) {
        addPlayers(newPlayers, currentLeagueId);
      }

      Alert.alert('Import complete', `${newPlayers.length}Players imported successfully!`);
    } catch (err) {
      console.error('Import failed', err);
      Alert.alert('Error', 'Failed to import players.');
    }
  };

  return (
    <>
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
          <View style={{ flexDirection: 'row', gap: 30, alignItems: 'center', paddingRight: 10 }}>
            {players.length === 0 && (
              <Pressable onPress={importFromCSV}>
                <MaterialCommunityIcons name="application-import" size={28} color={iconColor} />
              </Pressable>
            )}
            {players.length > 0 && (
              <Pressable onPress={exportToCSV}>
                <MaterialCommunityIcons name="application-export" size={28} color={iconColor} />
              </Pressable>
            )}
            <Pressable onPress={addNewPlayer}>
              <Ionicons name="person-add-sharp" size={28} color={iconColor} />
            </Pressable>
          </View>
        </View>
        {players.length === 0 && (
          <ThemedView style={{ padding: 12 }}>
            <ThemedText style={{ marginTop: 12 }}>
              No players defined. You can add players manually using the right icon on top of screen.
            </ThemedText>
            <ThemedText style={{ marginTop: 12 }}>
              You can also import a list of users from a CSV file using the left icon. The accepted format of
              the CSV file is shown below.
            </ThemedText>
            <ThemedText style={{ marginTop: 12 }}>Name,Speed Index,Email,Available</ThemedText>
            <ThemedText>For example:</ThemedText>
            <ThemedText>"name",1,"emailname@gmail.com",Yes</ThemedText>
            <ThemedText style={{ marginTop: 12 }}>note: Speed Index:1=fast 5=slow</ThemedText>
          </ThemedView>
        )}
        {players.length > 0 && (
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
                      <ThemedText>
                        {item.name}
                        {item.nickname ? ` (${item.nickname})` : ''}
                      </ThemedText>
                      <ThemedText numberOfLines={2} style={{ color: textDim }}>{`${
                        item.email ?? 'not specified'
                      }`}</ThemedText>
                    </View>
                  </Pressable>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Switch
                    trackColor={{ true: switchTrackColor }}
                    value={!!item.available}
                    onValueChange={() => toggleAvailable(item)}
                  />
                </View>
              </View>
            )}
          />
        )}
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
