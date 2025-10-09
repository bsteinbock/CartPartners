import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { createRound, getRoundById, getRoundSummaries, updateRoundById } from '@/lib/db-helper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Params = {
  id: string; // 'new' or numeric id
};

export default function RoundEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const isNew = id === 'new' || !id;

  const [round, setRound] = useState<any | null>(null);
  const [course, setCourse] = useState('');
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const courseRef = useRef<TextInput | null>(null);
  useEffect(() => {
    // focus name on mount
    setTimeout(() => courseRef.current?.focus?.(), 50);
    // if editing we could load player details here; the home screen already has the data,
    // but to keep this screen independent we won't fetch a single player record —
    // instead the route should be opened with the current values if needed.
    if (!isNew) {
      (async () => {
        try {
          const numericId = Number(id);
          if (Number.isFinite(numericId)) {
            const p = await getRoundById(numericId);
            if (p) {
              setCourse(p.course);
              setDate(new Date(p.date));
            }
          }
        } catch (e) {
          console.warn('Load player failed', e);
        }
      })();
    }
  }, [id]);

  const onChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios'); // keep picker open on iOS
    setDate(currentDate);
  };

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
        await createRound(course.trim(), date.toISOString());
      } else {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) throw new Error('invalid id');
        await updateRoundById(numericId, {
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

  const showDatepicker = () => {
    setShow(true);
  };

  const mark = async (status: any) => {
    const sums = await getRoundSummaries();
    const found = (sums as any).find((r: any) => r.id === round.id);
    setRound(found || null);
  };

  return (
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

        <ThemedText style={styles.label}>Date</ThemedText>
        <Button title="Show Date Picker" onPress={showDatepicker} />
        {show && (
          <>
            <ThemedText style={styles.label}>DateTimePicker</ThemedText>
            <DateTimePicker
              value={date}
              mode={'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChange}
            />
          </>
        )}
      </View>
      {errors.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {errors.map((e, i) => (
            <ThemedText key={i} style={{ color: 'red' }}>
              {e}
            </ThemedText>
          ))}
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <Button title="Save" onPress={onSave} />
        <View style={{ height: 8 }} />
        <Button title="Cancel" onPress={() => router.back()} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  input: { borderWidth: 1, padding: 8, borderRadius: 6, marginBottom: 12 },
});
