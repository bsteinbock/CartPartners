import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDate } from '@/lib/formatters';
import Entypo from '@expo/vector-icons/Entypo';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

export default function RoundsScreen() {
  const router = useRouter();
  const { rounds, roundSummaries, setCurrentRoundId } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');

  const createAndOpen = async () => {
    router.push({ pathname: '/edit-or-add', params: { id: 'new' } });
  };

  const setLineUp = (r: any) => {
    if (r && typeof r.id !== 'undefined') {
      setCurrentRoundId(r.id);
      router.replace({ pathname: '/lineup' });
    }
  };

  const openEdit = (r: any) => {
    if (r && typeof r.id !== 'undefined') {
      router.push({ pathname: '/edit-or-add', params: { id: String(r.id) } });
    }
  };

  return (
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

      <FlatList
        data={rounds}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => openEdit(item)}
            onPress={() => setLineUp(item)}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
          >
            <>
              <ThemedText>{`${item.course} (${formatDate(item.date)})`}</ThemedText>
              <ThemedText type="small">{`${
                roundSummaries.find((s) => s.round_id === item.id)?.numPlayers ?? 0
              } players`}</ThemedText>
            </>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
