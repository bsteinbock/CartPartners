import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

const LAST_NOTIFIED_UPDATE_ID = 'cartPartnerLastNotifiedUpdateId';

/**
 * Checks for OTA updates on mount and when the app returns to the foreground.
 * When an update is downloaded it prompts the user to restart.
 */
export function useOTAUpdates() {
  // Use a ref so the in-flight flag is always current inside the AppState listener
  // closure without requiring re-registration on every render.
  const isCheckingRef = useRef(false);

  const checkForUpdate = async () => {
    if (__DEV__) return; // updates are disabled in dev client
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Available', 'A new version has been downloaded. Restart now to apply it?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]);
      }
    } catch (e) {
      // Silently ignore update check failures — the user can keep using the current version
      if (__DEV__) {
        console.log('OTA update check failed:', e);
      }
    } finally {
      isCheckingRef.current = false;
    }
  };

  const notifyIfAppWasUpdated = async () => {
    if (__DEV__) return;

    try {
      // isEmbeddedLaunch is false when app is running an OTA update.
      const updateId = Updates.updateId;
      if (Updates.isEmbeddedLaunch || !updateId) return;

      const lastNotified = await SecureStore.getItemAsync(LAST_NOTIFIED_UPDATE_ID);
      if (lastNotified === updateId) return;

      await SecureStore.setItemAsync(LAST_NOTIFIED_UPDATE_ID, updateId);
      Alert.alert('App Updated', 'The latest update was applied successfully.');
    } catch (e) {
      if (__DEV__) {
        console.log('OTA update notification check failed:', e);
      }
    }
  };

  // Check on mount
  useEffect(() => {
    notifyIfAppWasUpdated();
    checkForUpdate();
  }, []);

  // Check when the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkForUpdate();
      }
    });

    return () => subscription.remove();
  }, []);
}
