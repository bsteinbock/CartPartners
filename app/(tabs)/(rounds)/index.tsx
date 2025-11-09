import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import SwipeableRound from '@/components/ui/SwipeableRound';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import Entypo from '@expo/vector-icons/Entypo';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoundsScreen() {
  const router = useRouter();
  const { rounds, roundSummaries, setCurrentRoundId } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');

  const createAndOpen = async () => {
    router.push({ pathname: '/edit-or-add', params: { id: 'new' } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <ThemedText type="title">Rounds</ThemedText>
          <Pressable onPress={createAndOpen}>
            <Entypo name="add-to-list" size={28} color={iconColor} />
          </Pressable>
        </View>
        <>
          {rounds.length === 0 && (
            <ThemedView style={{ flex: 1, padding: 12, marginTop: 40, alignItems: 'center' }}>
              <ThemedText type="title">Welcome</ThemedText>
              <ThemedText style={{ marginTop: 12 }}>
                CartPartners is designed to maximize your interaction with the rest of your golfing buddies.
                It does this by ensuring your cart partners are different from round to round.
              </ThemedText>
              <ThemedText style={{ marginTop: 12 }}>
                To get started just add a round using the icon in the top right. Once that is done, select the
                round and define the lineup of players for the round. Finally use the Group tab at the bottom
                to be taken to a screen that generate you Tee Groups and then allows you to notify them via
                email. For more info see the About tab.
              </ThemedText>
            </ThemedView>
          )}
          {rounds.length > 0 && (
            <FlatList
              data={rounds}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => <SwipeableRound round={item} />}
            />
          )}
        </>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
