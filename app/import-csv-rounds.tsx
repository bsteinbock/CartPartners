import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ImportRoundsCSVScreen() {
  const router = useRouter();
  const { addRound, currentLeagueId } = useDbStore();
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleImportCSV = async () => {
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
      if (lines.length < 2) {
        Alert.alert('Invalid CSV', 'The CSV file must contain at least a header row and one data row.');
        return;
      }

      const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
      const courseIndex = header.findIndex((h) => h.toLowerCase() === 'course');
      const dateIndex = header.findIndex((h) => h.toLowerCase() === 'date');
      const teeTimeInfoIndex = header.findIndex((h) => h.toLowerCase() === 'teetimeinfo');

      if (courseIndex === -1 || dateIndex === -1) {
        Alert.alert('Invalid CSV', 'The CSV must contain "Course" and "Date" columns.');
        return;
      }

      let roundsAdded = 0;
      let invalidRows = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // skip empty lines

        const cols = line.split(',').map((v) => v.replace(/"/g, '').trim());

        const course = cols[courseIndex]?.trim();
        const dateStr = cols[dateIndex]?.trim();
        const teeTimeInfo = teeTimeInfoIndex !== -1 ? cols[teeTimeInfoIndex]?.trim() || '' : '';

        // Validate required fields
        if (!course || !dateStr) {
          invalidRows++;
          continue;
        }

        // Parse and validate date
        const parsedDate = new Date(dateStr);
        if (Number.isNaN(parsedDate.getTime())) {
          invalidRows++;
          continue;
        }

        // Add the round
        try {
          addRound(course, parsedDate.toISOString(), teeTimeInfo, currentLeagueId ?? undefined);
          roundsAdded++;
        } catch (e) {
          console.warn('Failed to add round:', e);
          invalidRows++;
        }
      }

      if (roundsAdded === 0) {
        Alert.alert('Import Failed', 'No valid rounds were found in the CSV file.');
        return;
      }

      Alert.alert(
        'Import Complete',
        `${roundsAdded} round${roundsAdded !== 1 ? 's' : ''} added successfully!${
          invalidRows > 0
            ? `\n${invalidRows} row${invalidRows !== 1 ? 's' : ''} skipped due to invalid data.`
            : ''
        }`,
        [{ text: 'OK', onPress: () => router.back() }],
        { cancelable: false },
      );
    } catch (err) {
      console.error('Import failed', err);
      Alert.alert('Error', 'Failed to import rounds from CSV.');
    }
  };

  const downloadSampleCSV = useCallback(async () => {
    try {
      const csvString = [
        'Course,Date,TeeTimeInfo',
        '"Pebble Beach","2024-03-25","9:00 AM"',
        '"Cypress Point","2024-04-15","1:30 PM"',
        '"Torrey Pines","2024-05-10","10:30 AM"',
      ].join('\n');

      const fileName = 'cartpartners_sample_rounds.csv';
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
        dialogTitle: 'Sample Rounds CSV',
      });
    } catch (err) {
      console.error('Error creating sample CSV', err);
      Alert.alert('Error', 'Failed to create sample CSV.');
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, padding: 12 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={{ marginBottom: 16 }}>
            Import New Rounds from CSV
          </ThemedText>

          <ThemedText style={{ marginBottom: 16, lineHeight: 20 }}>
            Generate a template CSV file that you can fill out, or select an existing CSV file to import
            rounds. Required columns: Course and Date. Date format: YYYY-MM-DD or any valid date string.
          </ThemedText>

          <View style={{ gap: 20 }}>
            <ThemedView
              style={{
                marginHorizontal: 10,
                borderColor: iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton title="Generate Template CSV" onPress={downloadSampleCSV} />
            </ThemedView>
            <ThemedView
              style={{
                marginHorizontal: 10,
                borderColor: iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton title="Choose CSV File" onPress={handleImportCSV} />
            </ThemedView>
            <ThemedView
              style={{
                marginHorizontal: 10,
                borderColor: iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton title="Cancel" onPress={handleCancel} />
            </ThemedView>
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
