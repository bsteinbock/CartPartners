import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          CartPartners
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Overview
        </ThemedText>
        <ThemedText style={styles.text}>
          CartPartners is designed to maximize your interaction with the rest of your golfing buddies. It does
          this by ensuring that your cart partners are different from round to round.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          App Features
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Rounds Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This is were you define your round by specifying the course and date. Once created you tap on the
          round to set the active players for that week.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Groups Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          Create and manage the Playing Groups for the specified round. The round is automatically set to the
          round with the latest date. Press Generate to create the Groups for the round. If the Groups have
          already been created you can use Regenerate to update the set of groups. Once satisfied with the
          line-up use the airplane icon to create an email to all the player informing them of the groups.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Players Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This is where you manage your list of players and specify if they are currently available for being
          shown when setting up rounds.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 10,
  },
  subTitle: {
    marginTop: 15,
    marginBottom: 5,
  },
  text: {
    lineHeight: 24,
    marginBottom: 15,
  },
});
