import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Application from 'expo-application';
import React from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

export default function AboutScreen() {
  const { refreshAll } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const version = Application.nativeApplicationVersion || 'Unknown';
  const buildNumber = Application.nativeBuildVersion
    ? `(${Application.nativeBuildVersion} ${Platform.OS})`
    : `(${Platform.OS})`;
  const versionText = `Version: ${version}${buildNumber}`;

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="title" style={styles.title}>
            CartPartners
          </ThemedText>
        </ThemedView>
        <ThemedText style={{ marginBottom: 5 }}>{`CartPartners ${versionText}`}</ThemedText>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Overview
        </ThemedText>
        <ThemedText style={styles.text}>
          CartPartners is designed to maximize your interaction with the rest of your golfing buddies. It does
          this by ensuring your cart partners are different from round to round.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          App Features
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Rounds Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This is were you define your round by specifying the course and date. Once created tap on the round
          to open the line-up tab for the round.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Line-up Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This tab is used to specify the players that will be playing for this round. The list of players
          that is shown comes for all available players with their status set to available. To manage the list
          of available players press the icon on the top right of the screen.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Groups Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          Create and manage the Tee Time Groupings for the specified round. Press Generate to create the
          Groups for the round. If the Groups have already been created you can use Regenerate to update the
          set of groups. Once satisfied with the line-up use the airplane icon to create an email to all the
          player informing them of the groups. You can use the icon on the top right of the screen to manually
          set the players for any number of groups.
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
    textAlign: 'left',
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 22,
  },
  subTitle: {
    marginTop: 15,
    marginBottom: 5,
  },
  text: {
    lineHeight: 24,
  },
});
