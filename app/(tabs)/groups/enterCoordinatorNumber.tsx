import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SMS from 'expo-sms';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet } from 'react-native';

export default function GroupCoordinatorMobileNumberScreen() {
  const router = useRouter();
  const { bodyText, mobileNumbers } = useLocalSearchParams<{ bodyText: string; mobileNumbers: string }>();
  const [myNumber, setMyNumber] = useState('');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');

  // get mobile numbers array
  const mobilePhoneNumbers: string[] = mobileNumbers ? JSON.parse(mobileNumbers) : [];

  const sendTextMessage = async (addresses: string | string[], message: string) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS not available on this device');
      return;
    }

    const { result } = await SMS.sendSMSAsync(
      addresses, // recipient(s)
      message,
    );

    if (result === 'sent') {
      Alert.alert('Message sent!');
    } else {
      Alert.alert('Message not sent');
    }
  };

  const saveMyNumber = async () => {
    const normalizedNumber = myNumber.trim();
    if (normalizedNumber.length > 9) {
      await SecureStore.setItemAsync('cartPartnerGroupCoordinatorPhoneNumber', normalizedNumber);
    }
    // don't include my number in the list for texting
    if (normalizedNumber) {
      const index = mobilePhoneNumbers.indexOf(normalizedNumber);
      if (index > -1) {
        mobilePhoneNumbers.splice(index, 1);
      }
      await sendTextMessage(mobilePhoneNumbers, bodyText);
    }

    // navigate back to groups index with my number
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Define My Phone Number
      </ThemedText>
      <ThemedText style={styles.title}>
        This number will be excluded when sending text messages. Since you don't want to text yourself.
      </ThemedText>

      <ThemedText style={styles.label}>My Mobile Phone Number</ThemedText>
      <ThemedTextInput
        style={styles.input}
        value={myNumber}
        onChangeText={setMyNumber}
        placeholder="Mobile Number including area code"
        keyboardType="phone-pad"
      />
      <ThemedView
        style={{
          margin: 10,
          marginTop: 20,
          borderColor: myNumber.length < 10 ? disabledColor : iconButton,
          borderWidth: 1,
          borderRadius: 6,
        }}
      >
        <Button title="Finish" onPress={saveMyNumber} disabled={myNumber.length < 10} />
      </ThemedView>
    </ThemedView>
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
