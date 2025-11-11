import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { getDatabasePath, restoreDatabaseFromFile, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet } from 'react-native';

export default function BackupScreen() {
  const { refreshAll } = useDbStore();
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const version = Application.nativeApplicationVersion || 'Unknown';
  const buildNumber = Application.nativeBuildVersion
    ? `(${Application.nativeBuildVersion} ${Platform.OS})`
    : `(${Platform.OS})`;
  const versionText = `Version: ${version}${buildNumber}`;

  const handleImportDb = async () => {
    Alert.alert(
      'Import Database',
      'Are you sure you want to overwrite all your existing data with data from a different CartPartners database?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Import',
          style: 'default',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });

              if (result.canceled || !result.assets?.[0]?.uri) {
                return;
              }

              const selectedFileUri = result.assets[0].uri;

              // Optional: validate file
              if (!selectedFileUri.endsWith('.db')) {
                Alert.alert('Invalid file', 'Please select a valid SQLite database file.');
                return;
              }

              const fileRestored = await restoreDatabaseFromFile(selectedFileUri);
              if (fileRestored) {
                Alert.alert('Restore Successful', 'Database has been replaced.');
                refreshAll();
              } else Alert.alert('Restore Unsuccessful', 'Original Database has been restored.');
            } catch (error) {
              console.error('Restore error:', error);
              Alert.alert('Error', 'Failed to restore database. Original DB backed up.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleExportDb = async () => {
    Alert.alert(
      'Export Database',
      'Are you sure you want to export the CartPartners database?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Export',
          style: 'default',
          onPress: async () => {
            try {
              const dbPath = getDatabasePath();

              const canShare = await Sharing.isAvailableAsync();
              if (!canShare) {
                Alert.alert('Error', 'Sharing is not available on this device');
                return;
              }

              const now = new Date();
              const timestamp = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
              const fileName = `cartpartners-${timestamp}.db`;

              const sourceFile = new File(dbPath);
              const backupFile = new File(Paths.cache, fileName);
              if (backupFile.exists) {
                backupFile.delete();
              }
              sourceFile.copy(backupFile);

              await Sharing.shareAsync(backupFile.uri, {
                mimeType: 'application/x-sqlite3',
                dialogTitle: 'Export CartPartners Database',
                UTI: 'public.database', // iOS
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to export database');
              console.error('Export error:', error);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Backup Database
        </ThemedText>
        <ThemedText style={{ marginTop: 5 }}>
          Backing-up the CartPartner Database will protect you from losing all your data. It also allows the
          backup db file to be sent to another person if they are permanently or temporarily serving as Group
          Coordinator.
        </ThemedText>
        <ThemedView
          style={{
            margin: 10,
            marginBottom: 20,
            borderColor: iconButton,
            borderWidth: 1,
            borderRadius: 6,
          }}
        >
          <ThemedButton title="Backup Database" onPress={handleExportDb} />
        </ThemedView>
        <ThemedText type="title" style={[styles.title, { marginTop: 20, marginBottom: 5 }]}>
          Restore Database
        </ThemedText>

        <ThemedText>
          WARNING: Restoring the CartPartner Database will replace all the data that you are currently using
          with the data from a backed-up database.
        </ThemedText>
        <ThemedView
          style={{
            margin: 10,
            marginBottom: 20,
            borderColor: iconButton,
            borderWidth: 1,
            borderRadius: 6,
          }}
        >
          <ThemedButton title="Restore Database from backup" onPress={handleImportDb} />
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'left',
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 22,
  },
  subTitle: {
    marginTop: 15,
    marginBottom: 5,
  },
  text: {
    lineHeight: 24,
  },
});
