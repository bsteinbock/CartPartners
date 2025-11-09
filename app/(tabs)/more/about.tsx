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
          This Tab shows all your defined rounds and show a button to add a new round. If you long press on a
          round you will be taken to a screen to edit info about the round. You can swipe left on a round and
          delete it and all the data associated with it. A round is defined by specifying the course, date,
          and tee-time info. The Tee-time info is shown on the announcement sent to the players. A tap on the
          round will open the line-up tab for the round.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Line-up Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          This tab is used to specify the players that will be playing in the specified round. The list of
          players comes from all players that have their status set to available. To manage the list of
          available players press the icon on the top right of the screen. Once all the line-up is set press
          the Groups icon to open the Groups Tab.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Groups Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          Create and manage the Tee Time Groupings for the specified round. Press Generate to create the
          Groups for the round. If the Groups have already been created you can use Regenerate to update the
          set of groups. Once satisfied with the line-up use the airplane icon to create an email to all the
          player informing them of the groups. You can use the icon on the top right of the screen to manually
          set the players for any number of groups. Once the Groups have been generated you can modify their
          order or their players by touching the group you want to modify. When a group is selected icon
          buttons will display that will let you manually edit a group or move the group up or down in the
          order.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          More Tab
        </ThemedText>
        <ThemedText style={styles.text}>
          The More Tab provides access to other screens that are not directly related to creating groups. The
          initial screen allows you to notify any set of players via email or text message. The icon on the
          top left of the screen will open a panel that presents options to open this 'About' screen and to
          open the 'Backup/Restore' screen. The 'Backup/Restore' screen lets you create a database backup file
          of all the data you have in CartPartners. This file can be sent to another person that maybe taking
          over a Group Coordinator on either a temporary or permanent basis. Using the Restore command will
          let you load or reload data given a previous backup.
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
