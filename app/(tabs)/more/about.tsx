import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemedButton from '@/components/ui/ThemedButton';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch } from 'react-native';
import { ReactNativeLegal } from 'react-native-legal';

export default function AboutScreen() {
  const version = Application.nativeApplicationVersion || 'Unknown';
  const buildNumber = Application.nativeBuildVersion
    ? `(${Application.nativeBuildVersion} ${Platform.OS})`
    : `(${Platform.OS})`;
  const versionText = `Version: ${version}${buildNumber}`;
  const switchTrackColor = useThemeColor({ light: undefined, dark: undefined }, 'switchTrackColor');
  const [useEmailCC, setUseEmailCC] = useState<boolean>(false);

  // Load the setting on mount
  useEffect(() => {
    (async () => {
      const storedValue = await SecureStore.getItemAsync('cartPartnerUseEmailCC');
      setUseEmailCC(storedValue === 'true');
    })();
  }, []);

  // Save the setting when it changes
  const handleToggleEmailCC = async (value: boolean) => {
    setUseEmailCC(value);
    await SecureStore.setItemAsync('cartPartnerUseEmailCC', value.toString());
  };

  const showLicenses = () => {
    ReactNativeLegal.launchLicenseListScreen('Open Source Software Licenses');
  };

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
          tee-time information. The tee-time information will appear in the announcement sent to
          league_players. Tapping a round opens its Lineup tab.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.subTitle}>
          Lineup Tab
        </ThemedText>

        <ThemedText style={styles.text}>
          Use this tab to specify the players participating in a particular round. The picker at the top of
          the screen shows the current round and allows you to select a different one. The player list
          includes all golfers whose status is set to “available.” To add a player from the master player list
          to the round&apos;s lineup, tap the icon at the top right of the screen. Once the lineup is
          finalized, press the Groups icon at the bottom of the screen to open the Groups tab.
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
          The More tab provides access to additional screens not directly related to creating groups. The icon
          at the top left of the screen opens a panel with options to view the following screens: &quot;Notify
          Players&quot;, &quot;Leagues/Outings&quot;, &quot;Manage All Players&quot;, &quot;League
          Players&quot;, &quot;Backup / Restore&quot;, and &quot;About&quot;.
        </ThemedText>

        <ThemedText style={[styles.text, { marginTop: 10 }]}>
          The &quot;Notify Players&quot; screen lets you notify any group of players via email or text
          message. The list of players is specific to the current/active league. The league name is shown
          above the player selection area.
        </ThemedText>

        <ThemedText style={[styles.text, { marginTop: 10 }]}>
          The &quot;Leagues/Outings&quot; screen enables you to manage multiple leagues or outings, each with
          its own set of players and rounds.
        </ThemedText>

        <ThemedText style={[styles.text, { marginTop: 10 }]}>
          The &quot;Manage All Players&quot; screen allows you to add, edit, or delete players from the master
          player list. This list contains all players known to the app, regardless of their association with
          any league or outing. You can also import or export the player list as a CSV file for easy sharing
          or backup.
        </ThemedText>

        <ThemedText style={[styles.text, { marginTop: 10 }]}>
          The &quot;League Players&quot; screen allows you to define the list of players specific to a
          particular league or outing. You can add players from the master player list to the league. You can
          also swipe to delete players from the league. You can also export the players to a CSV file for use
          in other applications.
        </ThemedText>

        <ThemedText style={[styles.text, { marginTop: 10 }]}>
          The &quot;Backup/Restore&quot; screen allows you to create a database backup file containing all
          your CartPartners data. This file can be shared with another person taking over as Group
          Coordinator, either temporarily or permanently. Using the Restore command lets you load or reload
          data from a previous backup. Caution: Restoring a backup will overwrite all existing data in the
          app.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Settings
        </ThemedText>

        <ThemedView style={styles.settingRow}>
          <ThemedView style={styles.settingLabelContainer}>
            <ThemedText style={styles.settingLabel}>Use CC for Multiple Recipients</ThemedText>
            <ThemedText type="small" style={styles.settingDescription}>
              When enabled, email notifications will place the first recipient in the &quot;To&quot; field
              and remaining recipients in the &quot;CC&quot; field. This supports email clients like Yahoo
              Mail that only allow a single &quot;To&quot; recipient.
            </ThemedText>
          </ThemedView>
          <Switch trackColor={{ true: switchTrackColor }} value={useEmailCC} onValueChange={handleToggleEmailCC} />
        </ThemedView>

        <ThemedView style={styles.licenseButtonContainer}>
          <ThemedButton title="Show Source Licenses" onPress={showLicenses} />
        </ThemedView>
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
  licenseButtonContainer: {
    marginTop: 15,
    marginBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    lineHeight: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 15,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    lineHeight: 18,
  },
});
