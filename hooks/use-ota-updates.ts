import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

/**
 * Checks for OTA updates on mount and when the app returns to the foreground.
 * When an update is downloaded it prompts the user to restart.
 */
export function useOTAUpdates() {
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdate = async () => {
    if (__DEV__) return; // updates are disabled in dev client
    if (isChecking) return;

    setIsChecking(true);
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
      console.log('OTA update check failed:', e);
    } finally {
      setIsChecking(false);
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

  return { isChecking };
}
