import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import SwipeablePlayerItem from '@/components/ui/SwipeablePlayer';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164 } from '@/lib/cart-utils';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

export default function PlayersScreen() {
  const router = useRouter();
  const {
    addPlayers,
    updatePlayer,
    deletePlayer,
    all_players,
    refreshAll,
    currentLeagueId,
    addPlayersToLeague,
    league_players,
  } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');

  const handleDelete = (player: Player) => {
    Alert.alert(
      'Delete Player',
      `Are you sure you want to delete ${player.name}? This action cannot be undone. It
           will remove the player from all rounds and groups in all leagues.`,
      [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deletePlayer(player.id) }],
      { cancelable: true },
    );
  };

  const addNewPlayer = () => {
    router.push({ pathname: `/more/players/[id]`, params: { id: 'new' } });
  };

  const exportToCSV = async () => {
    if (!all_players || all_players.length === 0) {
      Alert.alert('No data', 'There are no players to export.');
      return;
    }

    try {
      const header = ['Name', 'Nickname', 'Speed Index', 'Email', 'Mobile #', 'Available'];
      const rows = all_players.map((p) => [
        `"${p.name}"`,
        `"${p.nickname || ''}"`,
        p.speedIndex,
        `"${p.email ?? ''}"`,
        `"${displayPhoneNumberFromE164(p.mobile_number) ?? ''}"`,
        p.available ? 'Yes' : 'No',
      ]);

      const csvString = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const fileName = 'cartpartners_all_players.csv';
      const file = new File(Paths.cache, fileName);
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
      Alert.alert('Error', 'Failed to export league_players.');
    }
  };

  const importFromCSV = async () => {
    if (all_players.length >= 0) {
      Alert.alert(
        'Import Players',
        'Importing players from a CSV file will add new players and update existing ones based on their names. Do you want to proceed?',
        [
          { text: 'Cancel' },
          { text: 'Import', onPress: () => proceedImport(false) },
          { text: 'Add to Active League', onPress: () => proceedImport(true) },
        ],
        { cancelable: true },
      );
    } else {
      proceedImport(false);
    }
  };

  const proceedImport = async (addToActiveLeague: boolean) => {
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
      const playerIdsToAddToLeague: Set<number> = new Set();
      const fileContent = await csvFile.text();

      // Split into lines and parse CSV
      const lines = fileContent.trim().split('\n');
      const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
      const nameIndex = header.findIndex((h) => h.toLowerCase() === 'name');
      const nicknameIndex = header.findIndex((h) => h.toLowerCase() === 'nickname');
      const mobileNumberIndex = header.findIndex((h) => h.toLowerCase().includes('mobile'));
      const speedIndexIdx = header.findIndex((h) => h.toLowerCase().includes('speed'));
      const emailIndex = header.findIndex((h) => h.toLowerCase() === 'email');
      const availableIndex = header.findIndex((h) => h.toLowerCase().includes('available'));

      if (nameIndex === -1) {
        Alert.alert('Invalid CSV', 'The CSV must contain a "Name" column.');
        return;
      }

      let newPlayers: Omit<Player, 'id'>[] = [];
      let numPlayersProcessed = 0;

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
        numPlayersProcessed++;
        // Check if league_player exists by name (case-insensitive)
        const existingPlayer = all_players.find(
          (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );

        if (existingPlayer && existingPlayer.id) {
          updatePlayer(existingPlayer.id, { speedIndex, email, available, nickname, mobile_number }, false);
          if (addToActiveLeague && currentLeagueId) {
            if (!league_players.find((lp) => lp.id === existingPlayer.id)) {
              playerIdsToAddToLeague.add(existingPlayer.id);
            }
          }
        } else {
          newPlayers.push({ name, speedIndex, email, available, nickname, mobile_number });
        }
      }

      if (playerIdsToAddToLeague.size > 0 && currentLeagueId) {
        addPlayersToLeague(Array.from(playerIdsToAddToLeague), currentLeagueId, false);
      }

      if (newPlayers.length > 0) {
        addPlayers(newPlayers, addToActiveLeague ? currentLeagueId : null, false);
      }

      refreshAll();

      Alert.alert('Import complete', `${numPlayersProcessed} players processed successfully!`);
    } catch (err) {
      console.error('Import failed', err);
      Alert.alert('Error', 'Failed to import league_players.');
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
          <ThemedView>
            <ThemedText type="title">Players</ThemedText>
            <ThemedText type="small">All Player</ThemedText>
          </ThemedView>
          <View style={{ flexDirection: 'row', gap: 30, alignItems: 'center', paddingRight: 10 }}>
            <Pressable onPress={importFromCSV}>
              <MaterialCommunityIcons name="application-import" size={28} color={iconColor} />
            </Pressable>
            {all_players.length > 0 && (
              <Pressable onPress={exportToCSV}>
                <MaterialCommunityIcons name="application-export" size={28} color={iconColor} />
              </Pressable>
            )}

            <Pressable onPress={addNewPlayer}>
              <FontAwesome5 name="plus-circle" size={28} color={iconColor} />
            </Pressable>
          </View>
        </View>
        {all_players.length === 0 && (
          <ThemedView style={{ padding: 12 }}>
            <ThemedText style={{ marginTop: 12 }}>
              No players defined. You can add players manually using the right icon on top of screen.
            </ThemedText>
            <ThemedText style={{ marginTop: 12 }}>
              You can also import a list of users from a CSV file using the left icon. The accepted format of
              the CSV file is shown below.
            </ThemedText>
            <ThemedText style={{ marginTop: 12 }}>Name,Speed Index,Email,Mobile#,Available</ThemedText>
            <ThemedText>For example:</ThemedText>
            <ThemedText>&quot;name&quot;,1,&quot;emailname@gmail.com&quot;,&quot;123-456-7890&quot;,Yes</ThemedText>
            <ThemedText style={{ marginTop: 12 }}>note: Speed Index:1=fast 5=slow</ThemedText>
          </ThemedView>
        )}
        {all_players.length > 0 && (
          <FlatList
            data={all_players}
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
              <SwipeablePlayerItem
                player={item}
                onPress={() => {
                  router.push({ pathname: '/more/players/[id]', params: { id: String(item.id) } });
                }}
                onDelete={handleDelete}
              />
            )}
          />
        )}
      </ThemedView>
    </>
  );
}
