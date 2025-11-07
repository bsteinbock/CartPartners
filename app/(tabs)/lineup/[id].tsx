import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { displayPhoneNumberFromE164, formatPhoneNumberToE164, generateNickname } from '@/lib/cart-utils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const insets = useSafeAreaInsets();

  const { players, addPlayer, updatePlayer } = useDbStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [speedIndex, setSpeedIndex] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      const existing = players.find((p) => p.id === Number(id));
      if (existing) {
        setName(existing.name);
        setEmail(existing.email || '');
        setSpeedIndex(String(existing.speedIndex));
        setMobileNumber(displayPhoneNumberFromE164(existing.mobile_number || ''));
        setNickname(existing.nickname || '');
      }
    }
  }, [id, players]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a player name.');
      return;
    }

    const speed = parseFloat(speedIndex);
    if (isNaN(speed)) {
      Alert.alert('Invalid Speed Index', 'Please enter a valid number.');
      return;
    }

    if (isNew) {
      addPlayer({
        name: name.trim(),
        email: email.trim(),
        speedIndex: speed,
        available: 1,
        nickname: nickname.trim() ?? generateNickname(name.trim()),
        mobile_number: formatPhoneNumberToE164(mobileNumber.trim()),
      });
      Alert.alert('Player Added', `${name} has been added`);
    } else {
      updatePlayer(Number(id), {
        name: name.trim(),
        email: email.trim(),
        speedIndex: speed,
        nickname: nickname.trim(),
        mobile_number: formatPhoneNumberToE164(mobileNumber.trim()),
      });
      Alert.alert('Player Updated', `${name} has been updated.`);
    }

    router.back();
  };

  return (
    <>
      <KeyboardAwareScrollView
        style={styles.container}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView>
          <ThemedText type="title" style={styles.title}>
            {isNew ? 'Add New Player' : 'Edit Player'}
          </ThemedText>

          <ThemedText style={styles.label}>Name</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Player name"
          />

          <ThemedText style={styles.label}>Nickname</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Player nickname"
          />

          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={email}
            autoCorrect={false}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
          />

          <ThemedText style={styles.label}>Mobile Number</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            onBlur={() => setMobileNumber(displayPhoneNumberFromE164(mobileNumber))}
            placeholder="Mobile Number"
            keyboardType="phone-pad"
          />

          <ThemedText style={styles.label}>Speed Index (1-Fast/3-Med/5-Slow)</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={speedIndex}
            onChangeText={setSpeedIndex}
            placeholder="Speed index"
            keyboardType="numeric"
          />

          <ThemedView style={{ marginTop: 12 }}>
            <Button title={isNew ? 'Add Player' : 'Save Changes'} onPress={handleSave} />
            <Button title="Cancel" color="gray" onPress={() => router.back()} />
          </ThemedView>
        </ThemedView>
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
});
