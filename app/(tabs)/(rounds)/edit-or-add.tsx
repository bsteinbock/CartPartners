import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { formatDate } from '@/lib/formatters';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

type Params = {
  id: string; // 'new' or numeric id
};

export default function RoundEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const isNew = id === 'new' || !id;
  const { rounds, addRound, updateRound } = useDbStore();

  const [course, setCourse] = useState('');
  const [date, setDate] = useState(new Date());
  const [errors, setErrors] = useState<string[]>([]);
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
          }
        }
      } catch (e) {
        console.warn('Load round failed', e);
      }
    }
  }, [id]);

  const validate = () => {
    const errs: string[] = [];
    const n = course.trim();
    if (!n) errs.push('Course is required');
    setErrors(errs);
    return errs.length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      if (isNew) {
        addRound(course.trim(), date.toISOString());
      } else {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) throw new Error('invalid id');
        updateRound(numericId, {
          course: course.trim(),
          date: date.toISOString(),
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
  const title = isNew ? 'Add round' : 'Edit round';
  return (
    <>
      <Stack.Screen options={{ title: 'Rounds' }} />

      <KeyboardAwareScrollView bottomOffset={35}>
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
          </View>
          <View style={{ marginTop: 16 }}>
            <Button title="Save" onPress={onSave} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" onPress={() => router.back()} />
          </View>
        </ThemedView>
      </KeyboardAwareScrollView>

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
