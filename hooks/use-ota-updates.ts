import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

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

  // Check on mount
  useEffect(() => {
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
