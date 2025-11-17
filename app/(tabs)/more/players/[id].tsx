import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { iosKeyboardToolbarOffset } from '@/constants/theme';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { displayPhoneNumberFromE164, formatPhoneNumberToE164, generateNickname } from '@/lib/cart-utils';
import { Header } from '@react-navigation/elements';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');

  const { all_players, addPlayer, updatePlayer } = useDbStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [speedIndex, setSpeedIndex] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      const existing = all_players.find((p) => p.id === Number(id));
      if (existing) {
        setName(existing.name);
        setEmail(existing.email || '');
        setSpeedIndex(String(existing.speedIndex));
        setMobileNumber(displayPhoneNumberFromE164(existing.mobile_number || ''));
        setNickname(existing.nickname || '');
      }
    }
  }, [id, all_players, isNew]);

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
      addPlayer(
        {
          name: name.trim(),
          email: email.trim(),
          speedIndex: speed,
          available: 1,
          nickname: nickname.trim() ?? generateNickname(name.trim()),
          mobile_number: formatPhoneNumberToE164(mobileNumber.trim()),
        },
        null,
      );
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
      {Platform.OS === 'android' && (
        <Stack.Screen
          options={{
            header: (props) => (
              <Header
                title="Define Players"
                {...props}
                headerStyle={{
                  height: 36,
                }}
              />
            ),
            headerShown: true,
          }}
        />
      )}
      <ThemedView style={{ flex: 1 }}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>
              {isNew ? 'Add New Player' : 'Edit Player'}
            </ThemedText>
            <ThemedText type="small">Master Player List</ThemedText>

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
              placeholder="Mobile Number including area code"
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

            <ThemedView>
              <ThemedView
                style={{
                  marginTop: 10,
                  borderColor: iconButton,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title={isNew ? 'Add Player' : 'Save Changes'} onPress={handleSave} />
              </ThemedView>
              <ThemedView
                style={{
                  marginTop: 10,
                  borderColor: textDim,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title="Cancel" color={textDim} onPress={() => router.back()} />
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </KeyboardAwareScrollView>
      </ThemedView>
      {Platform.OS === 'ios' && <KeyboardToolbar offset={{ opened: iosKeyboardToolbarOffset }} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  title: {
    marginBottom: 6,
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
