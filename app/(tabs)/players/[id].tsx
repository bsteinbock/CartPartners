import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { addPlayer, getPlayerById, updatePlayerById } from '@/lib/db-helper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Keyboard, StyleSheet, Switch, TextInput, View } from 'react-native';

type Params = {
  id: string; // 'new' or numeric id
};

export default function PlayerEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams() as Params;
  const isNew = id === 'new' || !id;

  const [name, setName] = useState('');
  const [speedIndex, setSpeedIndex] = useState('3');
  const [available, setAvailable] = useState(true);
  const [email, setEmail] = useState(''); // added email state
  const [errors, setErrors] = useState<string[]>([]);

  const nameRef = useRef<any>(null);

  useEffect(() => {
    // focus name on mount
    setTimeout(() => nameRef.current?.focus?.(), 50);
    if (!isNew) {
      (async () => {
        try {
          const numericId = Number(id);
          if (Number.isFinite(numericId)) {
            const p = await getPlayerById(numericId);
            if (p) {
              setName(p.name);
              setSpeedIndex(String(p.speedIndex));
              setAvailable(p.available === undefined ? true : !!p.available);
              setEmail(p.email ?? ''); // load email when editing
            }
          }
        } catch (e) {
          console.warn('Load player failed', e);
        }
      })();
    }
  }, [id]);

  const validate = () => {
    const errs: string[] = [];
    const n = name.trim();
    if (!n) errs.push('Name is required');
    const s = Number(speedIndex);
    if (!Number.isFinite(s) || isNaN(s)) errs.push('Speed must be a number');
    else if (s < 0) errs.push('Speed must be 0 or greater');
    // optional: basic email sanity check
    if (email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.push('Email appears invalid');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      if (isNew) {
        await addPlayer({
          name: name.trim(),
          speedIndex: Number(speedIndex),
          available,
          email: email.trim() || null,
        });
      } else {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) throw new Error('invalid id');
        // updatePlayerById signature may not include email in its TS type; cast to any to pass email through
        await updatePlayerById(numericId, {
          name: name.trim(),
          speedIndex: Number(speedIndex),
          available,
          email: email.trim() || null,
        } as any);
      }
      Keyboard.dismiss();
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
          placeholder="Enter Player Name"
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

        <ThemedText style={styles.label}>Email (optional)</ThemedText>
        <ThemedTextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="player@example.com"
        />

        {isNew && (
          <View style={{ marginVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Switch value={available} onValueChange={(value) => setAvailable(value)} />
            <ThemedText style={{ marginLeft: 12 }}>{available ? 'Available' : 'Unavailable'}</ThemedText>
          </View>
        )}
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
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  input: { borderWidth: 1, padding: 8, borderRadius: 6, marginBottom: 12 },
});
