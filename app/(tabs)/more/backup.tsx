import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import {
  backupDatabase,
  cloudBackupDatabase,
  cloudRestoreDatabase,
  restoreDatabaseFromFile,
  useDbStore,
} from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

export default function BackupScreen() {
  const { refreshAll } = useDbStore();
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const [cloudBackupUrl, setCloudBackupUrl] = useState<string>('');
  const [cloudApiKey, setCloudApiKey] = useState<string>('');

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const url = await SecureStore.getItemAsync('cartPartnerBackupServerUrl');
        setCloudBackupUrl(url ?? '');
        const key = await SecureStore.getItemAsync('cartPartnerBackupApiKey');
        setCloudApiKey(key ?? '');
      })();
    }, []),
  );

  const isCloudConfigured = cloudBackupUrl.trim().length > 0 && cloudApiKey.trim().length > 0;

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

  const handleCloudBackup = () => {
    Alert.alert(
      'Cloud Backup',
      'Upload the current database to your backup server? This will overwrite any existing cloud backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            try {
              await cloudBackupDatabase(cloudBackupUrl, cloudApiKey);
              Alert.alert('Cloud Backup Successful', 'Database has been uploaded to the backup server.');
            } catch (error: unknown) {
              console.error('Cloud backup error:', error);
              Alert.alert('Cloud Backup Failed', error instanceof Error ? error.message : 'Unknown error');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleCloudRestore = () => {
    Alert.alert(
      'Cloud Restore',
      'Are you sure you want to replace all your current data with the last cloud backup?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await cloudRestoreDatabase(cloudBackupUrl, cloudApiKey);
              if (success) {
                Alert.alert('Cloud Restore Successful', 'Database has been restored from the backup server.');
                refreshAll();
              } else {
                Alert.alert(
                  'Cloud Restore Failed',
                  'The server backup could not be restored. Your original database has been preserved.',
                );
              }
            } catch (error: unknown) {
              console.error('Cloud restore error:', error);
              Alert.alert('Cloud Restore Failed', error instanceof Error ? error.message : 'Unknown error');
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
              await backupDatabase();
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

        {isCloudConfigured && (
          <>
            <ThemedText type="title" style={[styles.title, { marginTop: 20 }]}>
              Cloud Backup
            </ThemedText>
            <ThemedText style={{ marginTop: 5, marginBottom: 10 }}>
              Upload the current database to your configured backup server. This overwrites any previous cloud
              backup.
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
              <ThemedButton title="Cloud Backup" onPress={handleCloudBackup} />
            </ThemedView>

            <ThemedText type="title" style={[styles.title, { marginTop: 20 }]}>
              Cloud Restore
            </ThemedText>
            <ThemedText style={{ marginTop: 5, marginBottom: 10 }}>
              WARNING: Restoring from the cloud will replace all your current data with the last cloud backup.
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
              <ThemedButton title="Cloud Restore" onPress={handleCloudRestore} />
            </ThemedView>
          </>
        )}
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
