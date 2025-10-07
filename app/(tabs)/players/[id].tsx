import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { addPlayer, updatePlayerById } from '@/lib/db-helper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

type Params = {
  id: string; // 'new' or numeric id
};

export default function PlayerEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const isNew = id === 'new' || !id;

  const [name, setName] = useState('');
  const [speedIndex, setSpeedIndex] = useState('0');
  const [available, setAvailable] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const nameRef = useRef<TextInput | null>(null);

  useEffect(() => {
    // focus name on mount
    setTimeout(() => nameRef.current?.focus?.(), 50);
    // if editing we could load player details here; the home screen already has the data,
    // but to keep this screen independent we won't fetch a single player record —
    // instead the route should be opened with the current values if needed.
    if (!isNew) {
      (async () => {
        try {
          const numericId = Number(id);
          if (Number.isFinite(numericId)) {
            const p = await (await import('@/lib/db-helper')).getPlayerById(numericId);
            if (p) {
              setName(p.name);
              setSpeedIndex(String(p.speedIndex));
              setAvailable(p.available === undefined ? true : !!p.available);
            }
          }
        } catch (e) {
          console.warn('Load player failed', e);
        }
      })();
    }
  }, []);

  const validate = () => {
    const errs: string[] = [];
    const n = name.trim();
    if (!n) errs.push('Name is required');
    const s = Number(speedIndex);
    if (!Number.isFinite(s) || isNaN(s)) errs.push('Speed must be a number');
    else if (s < 0) errs.push('Speed must be 0 or greater');
    setErrors(errs);
    return errs.length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      if (isNew) {
        await addPlayer({ name: name.trim(), speedIndex: Number(speedIndex), available });
      } else {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) throw new Error('invalid id');
        await updatePlayerById(numericId, { name: name.trim(), speedIndex: Number(speedIndex), available });
      }
      Keyboard.dismiss();
      // navigate back
      router.back();
    } catch (e) {
      console.warn('Save failed', e);
      Alert.alert('Save failed');
    }
  };

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title">{isNew ? 'Add player' : 'Edit player'}</ThemedText>

      <View style={{ marginTop: 12 }}>
        <ThemedText style={styles.label}>Name</ThemedText>
        <ThemedTextInput
          ref={nameRef}
          style={styles.input}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />

        <ThemedText style={styles.label}>Speed Index</ThemedText>
        <ThemedTextInput
          style={styles.input}
          value={speedIndex}
          onChangeText={setSpeedIndex}
          keyboardType="numeric"
        />

        <ThemedText style={styles.label}>Available</ThemedText>
        <View style={{ marginBottom: 12 }}>
          <Button title={available ? 'Available' : 'Unavailable'} onPress={() => setAvailable((v) => !v)} />
        </View>

        {errors.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {errors.map((e, i) => (
              <Text key={i} style={{ color: 'red' }}>
                {e}
              </Text>
            ))}
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Button title="Save" onPress={onSave} />
          <View style={{ height: 8 }} />
          <Button title="Cancel" onPress={() => router.back()} />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  input: { borderWidth: 1, padding: 8, borderRadius: 6, marginBottom: 12 },
});
