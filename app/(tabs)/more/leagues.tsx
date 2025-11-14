import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import SwipeableLeague from '@/components/ui/SwipeableLeague';
import ThemedButton from '@/components/ui/ThemedButton';
import { League, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LeaguesScreen() {
  const { leagues, addLeague } = useDbStore();
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const leagueEditIdRef = useRef(0);
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');
  const border = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const insets = useSafeAreaInsets();

  function openAdd() {
    leagueEditIdRef.current = 0;
    setNewName('');
    setAddModalVisible(true);
  }

  function saveName() {
    const name = newName.trim() || 'New League';
    const id = leagueEditIdRef.current;
    if (id) {
      // editing existing league
      useDbStore.getState().updateLeague(id, name);
    } else {
      // adding new league
      addLeague(name);
    }
    setAddModalVisible(false);
  }

  function onPressLeague(item: League) {
    leagueEditIdRef.current = Number(item.id);
    setNewName(item.name);
    setAddModalVisible(true);
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={{ padding: 10, marginBottom: 20 }}>
        <ThemedText>
          Cart Partners may be utilized to organize groups for season-long leagues, multi-day outings, or
          special golf events. Player, round, and group information is maintained separately for each entry.
        </ThemedText>
      </ThemedView>
      <ThemedView style={[styles.header, { borderBottomColor: border }]}>
        <ThemedText type="subtitle">Leagues / Outings</ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <FontAwesome5 name="plus-circle" size={28} color={iconButton} />
        </TouchableOpacity>
      </ThemedView>

      {leagues.length > 0 && (
        <FlatList
          data={leagues}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SwipeableLeague league={item} onPress={onPressLeague} />}
          ListEmptyComponent={
            <ThemedView style={styles.empty}>
              <ThemedText style={styles.emptyThemedText}>No leagues yet. Tap + to add one.</ThemedText>
            </ThemedView>
          }
        />
      )}

      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <ThemedView style={[styles.modalBackdrop, { paddingTop: insets.top + 60 }]}>
          <ThemedView style={styles.modal}>
            <ThemedText style={styles.modalTitle}>Set League / Outing Name</ThemedText>
            <ThemedTextInput
              placeholder="League / Outing name"
              value={newName}
              onChangeText={setNewName}
              style={styles.input}
              autoFocus
            />
            <ThemedView style={styles.modalActions}>
              <ThemedView
                style={{
                  flex: 1,
                  margin: 10,
                  borderColor: iconButton,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title="Cancel" onPress={() => setAddModalVisible(false)} />
              </ThemedView>

              <ThemedView
                style={{
                  flex: 1,
                  margin: 10,
                  borderColor: newName.length === 0 ? disabledColor : iconButton,
                  borderWidth: 1,
                  borderRadius: 6,
                }}
              >
                <ThemedButton title="Save" onPress={saveName} disabled={newName.length === 0} />
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { padding: 24, alignItems: 'center' },
  emptyThemedText: { color: '#666' },

  modalBackdrop: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modal: {
    borderRadius: 8,
    padding: 16,
    elevation: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 20, gap: 20 },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  cancelBtn: { backgroundColor: '#eee' },
  saveBtn: { backgroundColor: '#007AFF' },
  modalBtnThemedText: { color: '#fff' },
});
