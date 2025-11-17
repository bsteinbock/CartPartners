import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { iosKeyboardToolbarOffset } from '@/constants/theme';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDate } from '@/lib/formatters';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

type Params = {
  id: string; // 'new' or numeric id
};

export default function RoundEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const isNew = id === 'new' || !id;
  const { rounds, addRound, updateRound, currentLeagueId } = useDbStore();
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');

  const [course, setCourse] = useState('');
  const [teeTimeInfo, setTeeTimeInfo] = useState('');
  const [date, setDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const courseRef = useRef<any>(null);
  useEffect(() => {
    // focus name on mount
    setTimeout(() => courseRef.current?.focus?.(), 50);
    // if editing we could load player details here; the home screen already has the data,
    // but to keep this screen independent we won't fetch a single player record —
    // instead the route should be opened with the current values if needed.
    if (!isNew) {
      try {
        const numericId = Number(id);
        if (Number.isFinite(numericId)) {
          const p = rounds.find((r) => r.id === numericId);
          if (p) {
            setCourse(p.course);
            setDate(new Date(p.date));
            setTeeTimeInfo(p.teeTimeInfo);
          }
        }
      } catch (e) {
        console.warn('Load round failed', e);
      }
    }
  }, [id, isNew, rounds]);

  const onSave = () => {
    try {
      if (isNew) {
        addRound(course.trim(), date.toISOString(), teeTimeInfo, currentLeagueId);
      } else {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) throw new Error('invalid id');
        updateRound(numericId, {
          course: course.trim(),
          date: date.toISOString(),
          teeTimeInfo,
        });
      }
      Keyboard.dismiss();
      // navigate back
      router.back();
    } catch (e) {
      console.warn('Save failed', e);
      Alert.alert('Save failed');
    }
  };

  const handleDateConfirm = (selectedDate: Date) => {
    setDate(selectedDate);
    hideDatePicker();
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Rounds' }} />

      <KeyboardAwareScrollView bottomOffset={45} keyboardShouldPersistTaps="handled">
        <ThemedView style={{ flex: 1, padding: 16 }}>
          <ThemedText type="title">{isNew ? 'Add round' : 'Edit round'}</ThemedText>
          <View style={{ marginTop: 12 }}>
            <ThemedText style={styles.label}>Course</ThemedText>
            <ThemedTextInput
              ref={courseRef}
              style={styles.input}
              placeholder="Enter Course Name"
              value={course}
              onChangeText={setCourse}
              returnKeyType="next"
            />
            <View style={styles.dateContainer}>
              <TouchableOpacity activeOpacity={1} onPress={showDatePicker}>
                <ThemedText style={styles.label}>Date</ThemedText>
                <ThemedTextInput
                  readOnly={true}
                  placeholder="Date"
                  onPressIn={showDatePicker}
                  value={date ? formatDate(date) : 'No date selected'}
                />
              </TouchableOpacity>
            </View>
            <ThemedTextInput
              style={[styles.input, { marginTop: 12 }]}
              numberOfLines={3}
              multiline={true}
              placeholder="Tee-time info"
              value={teeTimeInfo}
              onChangeText={setTeeTimeInfo}
              returnKeyType="next"
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
            <ThemedView
              style={{
                margin: 10,
                borderColor: course.trim() === '' ? disabledColor : iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton title="Save" disabled={course.trim() === ''} onPress={onSave} />
            </ThemedView>
            <ThemedView
              style={{
                margin: 10,
                borderColor: iconButton,
                borderWidth: 1,
                borderRadius: 6,
              }}
            >
              <ThemedButton title="Cancel" onPress={() => router.back()} />
            </ThemedView>
          </View>
        </ThemedView>
      </KeyboardAwareScrollView>
      {Platform.OS === 'ios' && <KeyboardToolbar offset={{ opened: iosKeyboardToolbarOffset }} />}

      <DateTimePickerModal
        style={{ alignSelf: 'stretch' }}
        date={new Date(date)}
        isVisible={datePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={hideDatePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  dateContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateInput: {
    borderWidth: 1,
    alignContent: 'stretch',
    justifyContent: 'center',
    borderRadius: 5,
    paddingHorizontal: 8,
    height: 40,
    paddingVertical: 0,
  },
});
