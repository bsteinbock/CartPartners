import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function ModifyGroup() {
  const { groupId } = useLocalSearchParams();
  const router = useRouter();
  const { groupPlayers } = useDbStore();

  const addPlayerToGroup = async () => {
    //Todo
  };

  // Rest of the component remains the same
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Modify Group',
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '500',
          },
        }}
      />
    </ThemedView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1 },
  // ... existing styles ...
});
