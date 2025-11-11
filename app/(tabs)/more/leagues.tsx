import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { League, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Button, FlatList, Modal, StyleSheet, TouchableOpacity } from 'react-native';

export default function LeaguesScreen() {
  const router = useRouter();
  const { leagues, addLeague } = useDbStore();
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const leagueEditIdRef = useRef(0);
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const disabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');

  function openAdd() {
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
          Cart Partners can be used to organize groups for season long leagues, multi-day outings, or special
          golf events. Players, Rounds, and Groups are kept separate per entry.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Leagues / Outings</ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <ThemedText style={styles.addIcon}>＋</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onPressLeague(item)} activeOpacity={0.7}>
            <ThemedText style={styles.rowThemedText}>{item.name}</ThemedText>
            <ThemedText style={styles.chev}>›</ThemedText>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <ThemedText style={styles.emptyThemedText}>No leagues yet. Tap + to add one.</ThemedText>
          </ThemedView>
        }
      />

      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <ThemedView style={styles.modalBackdrop}>
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
                <Button title="Cancel" onPress={() => setAddModalVisible(false)} />
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
                <Button title="Save" onPress={saveName} disabled={newName.length === 0} />
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
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    position: 'absolute',
    right: 16,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { color: '#fff', fontSize: 20, lineHeight: 20 },
  listContent: { paddingVertical: 8 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowThemedText: { fontSize: 16 },
  chev: { color: '#999', fontSize: 18 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' },
  empty: { padding: 24, alignItems: 'center' },
  emptyThemedText: { color: '#666' },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
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
