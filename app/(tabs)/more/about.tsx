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
          CartPartners is designed to help you stay connected with your golfing buddies by ensuring that your
          cart partners change from round to round. CartPartners supports organizing players into leagues or
          outings, managing player availability, creating rounds, generating tee-time groups, and sending
          notifications to players via email or text message.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          App Features
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Rounds Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This tab displays all your defined rounds and includes a button to add a new round. The picker at
          the very top of the screen allows you to select a specific league or outing. If you long-press on a
          round, you will be taken to a screen where you can edit its details. You can also swipe left on a
          round to delete it and all associated data. A round is defined by specifying the course, date, and
          tee-time information. The tee-time details appear in the announcement sent to players. Tapping a
          round opens its Lineup tab.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Lineup Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          Use this tab to specify the players participating in a particular round. The player list includes
          all golfers whose status is set to “available.” To manage the list of available players, tap the
          icon at the top right of the screen. Once the lineup is finalized, press the Groups icon to open the
          Groups tab.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Groups Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          Create and manage the tee-time groupings for a round. Press “Generate” to create the groups, or
          “Regenerate” to update them if they already exist. Once you are satisfied with the lineup, use the
          airplane icon to send an email to all players informing them of their groups. You can also use the
          icon at the top right of the screen to manually adjust the players in any group. After generating
          groups, you can modify their order or swap players by selecting a group. When a group is selected,
          icon buttons will appear, allowing you to edit or move the group up or down in the order.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          More Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          The More tab provides access to additional screens not directly related to creating groups. The
          initial screen lets you notify any group of players via email or text message. The icon at the top
          left of the screen opens a panel with options to view this “About” screen or the “Backup/Restore”
          screen. The Backup/Restore screen allows you to create a database backup file containing all your
          CartPartners data. This file can be shared with another person taking over as Group Coordinator,
          either temporarily or permanently. Using the Restore command lets you load or reload data from a
          previous backup. The Leagues/Outings screen enables you to manage multiple leagues or outings, each
          with its own set of players and rounds.
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
