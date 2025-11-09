import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-textinput';
import { ThemedView } from '@/components/themed-view';
import { Player, useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useEffect, useState } from 'react';
import { Button, StyleSheet } from 'react-native';
import { FlatList, Switch } from 'react-native-gesture-handler';

export default function MessageScreen() {
  const iconButton = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const [message, setMessage] = useState<string>('');
  const { players } = useDbStore();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  useEffect(() => {
    setAvailablePlayers(players.filter((p) => p.available));
  }, [players]);

  // Toggle a player's selection
  const togglePlayer = (playerId: number) => {
    setSelectedPlayers((prev) => {
      const newSelection = prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId];
      return newSelection;
    });
  };

  // Select or clear all players
  const toggleAllPlayers = () => {
    const allIds = players.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPlayers.includes(id));
    const newSelection = allSelected ? [] : allIds;
    setSelectedPlayers(newSelection);
  };

  const allSelected = players.length > 0 && players.every((p) => selectedPlayers.includes(p.id));
  const playerLabel = `Player (${selectedPlayers.length} of ${players.length} Selected)`;

  return (
    <ThemedView style={styles.container}>
      <ThemedTextInput
        style={[styles.input, { marginTop: 12 }]}
        numberOfLines={6}
        multiline={true}
        placeholder="Enter Message"
        value={message}
        onChangeText={setMessage}
        returnKeyType="next"
      />
      <ThemedView style={{ flex: 1 }}>
        {availablePlayers.length === 0 ? (
          <ThemedView style={[styles.stepContainer, { margin: 12 }]}>
            <ThemedText>
              No players available. Go to Players Management screen using the icon on the top right of this
              screen.
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            <ThemedView
              style={{
                padding: 8,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderColor: '#ddd',
                gap: 30,
              }}
            >
              <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Switch
                  value={allSelected}
                  onValueChange={toggleAllPlayers}
                  disabled={players.length === 0}
                />
              </ThemedView>
              <ThemedText style={{ fontWeight: '700' }}>{playerLabel}</ThemedText>
            </ThemedView>

            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={availablePlayers}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <ThemedView
                  style={{
                    padding: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={selectedPlayers.includes(item.id)}
                      onValueChange={(_val) => {
                        void togglePlayer(item.id);
                      }}
                    />
                    <ThemedText style={{ marginLeft: 30 }}>{item.name}</ThemedText>
                  </ThemedView>
                </ThemedView>
              )}
            />
          </>
        )}
      </ThemedView>
      <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
        <ThemedView
          style={{
            margin: 10,
            flex: 1,
            borderColor: iconButton,
            borderWidth: 1,
            borderRadius: 6,
          }}
        >
          <Button
            title="Email"
            onPress={() => {
              setMessage('');
            }}
          />
        </ThemedView>
        <ThemedView
          style={{
            flex: 1,
            margin: 10,
            borderColor: iconButton,
            borderWidth: 1,
            borderRadius: 6,
          }}
        >
          <Button
            title="Text Msg"
            onPress={() => {
              setMessage('');
            }}
          />
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    minHeight: 120,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
