// utils.ts
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import { Linking } from 'react-native';
import { Group, GroupPlayers, ManualGroupList, Player, Round, RoundPlayer } from '../hooks/use-dbStore';

export { generateGroupsForRound, getGroupSizes, localSwapImprove, scoreGroupArrangement } from './grouping';
export type { GroupParams } from './grouping';

/**
 * Builds a mapping of each playerId to their recent playing partners and
 * the number of times they’ve played together.
 *
 * @param playerIds - The player IDs to analyze
 * @param recentGroups - The array of GroupPlayer from all groups/rounds
 * @returns Record<number, Record<number, number>>
 *          Map of playerId → { partnerId → timesPlayedTogether }
 */
export function buildPlayingPartnerFrequencies(
  playerIds: number[],
  groupPlayerArray: GroupPlayers[],
): Record<number, Record<number, number>> {
  const groupPlayers = groupPlayerArray.map((gp) => gp.player_ids);

  // Initialize the structure
  const partnerFreqMap: Record<number, Record<number, number>> = {};

  for (const playerId of playerIds) {
    partnerFreqMap[playerId] = {};
  }

  // Loop through each group (representing one group in a round)
  for (const group of groupPlayers) {
    for (const playerId of group) {
      // Only track players in our target list
      if (!partnerFreqMap[playerId]) continue;

      for (const partnerId of group) {
        if (partnerId === playerId) continue;

        // Initialize the partner count if missing
        if (!partnerFreqMap[playerId][partnerId]) {
          partnerFreqMap[playerId][partnerId] = 0;
        }

        // Increment how many times they’ve played together
        partnerFreqMap[playerId][partnerId]++;
      }
    }
  }

  return partnerFreqMap;
}

export function buildGroupingHistory(
  playerIds: number[],
  currentRoundId: number,
  rounds: Pick<Round, 'id' | 'date' | 'league_id'>[],
  groups: Group[],
  groupPlayers: GroupPlayers[],
  roundPlayers: RoundPlayer[],
) {
  const currentRound = rounds.find((round) => round.id === currentRoundId);
  if (!currentRound) throw new Error('Cannot generate groups: the selected round was not found.');
  const currentTime = new Date(currentRound.date).getTime();
  if (!Number.isFinite(currentTime)) {
    throw new Error('Cannot generate groups: the selected round has an invalid date.');
  }

  const priorRounds = rounds
    .map((round) => {
      const time = new Date(round.date).getTime();
      if (!Number.isFinite(time)) throw new Error(`Cannot generate groups: round ${round.id} has an invalid date.`);
      return { round, time };
    })
    .filter(({ round, time }) => time < currentTime || (time === currentTime && round.id < currentRoundId))
    .sort((a, b) => b.time - a.time || b.round.id - a.round.id);
  const priorRoundIds = new Set(priorRounds.map(({ round }) => round.id));
  const priorGroups = groups.filter((group) => priorRoundIds.has(group.round_id));
  const priorGroupIds = new Set(priorGroups.map((group) => group.id));
  const priorGroupPlayers = groupPlayers.filter((group) => priorGroupIds.has(group.group_id));
  const roundParticipation: Record<number, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const entry of roundPlayers) {
    if (priorRoundIds.has(entry.round_id) && entry.player_id in roundParticipation) {
      roundParticipation[entry.player_id]++;
    }
  }
  const playersByGroupId = new Map(priorGroupPlayers.map((group) => [group.group_id, group.player_ids]));
  const recentRoundGroups = priorRounds
    .filter(({ round }) => round.league_id === currentRound.league_id)
    .slice(0, 2)
    .map(({ round }) =>
      priorGroups
        .filter((group) => group.round_id === round.id)
        .map((group) => playersByGroupId.get(group.id))
        .filter((players): players is number[] => players !== undefined),
    );

  return {
    partnerFrequencies: buildPlayingPartnerFrequencies(playerIds, priorGroupPlayers),
    roundParticipation,
    recentRoundGroups,
  };
}

/**
 * Given a list of player IDs, return the corresponding Player objects.
 * @param playerIds - Array of player IDs from group specification
 * @param players - Array of all Player objects
 * @returns Array of Player objects matching the given IDs
 */
export function getPlayerForGroup(playerIds: number[], players: Player[]): Player[] {
  return playerIds.map((pid) => players.find((p) => p.id === pid)).filter((p): p is Player => Boolean(p)); // filter out undefined
}

/**
 * Converts ManualGroupList into readable strings of player names.
 * @param groupPlayers - The ManualGroupList array
 * @param players - The full list of Player objects.
 * @returns An array of strings, one per group.
 */
export function formatManualGroupPlayersByNames(
  groupPlayers: ManualGroupList[],
  players: Player[],
): string[] {
  return groupPlayers.map((gp) => {
    const names = gp
      .map((pid) => {
        const player = players.find((p) => p.id === pid);
        if (!player) return undefined;
        return player.nickname?.trim().length ? player.nickname : player.name;
      })
      .filter((name): name is string => Boolean(name)); // remove undefined

    return names.join(', ');
  });
}

/**
 * Convert groups of player IDs into groups of player names for reporting.
 *
 * @param groups - Array of groups (each a list of player IDs)
 * @param allPlayers - Array of all Player objects
 * @param useSeparateLineForNames - Put group header and names on separate lines for better readability (default: false)
 * @returns string - Formatted report showing each group with player names
 */
export function reportGroupsWithNames(
  groups: GroupPlayers[],
  allPlayers: Player[],
  useSeparateLineForNames = false,
): string {
  const playerMap: Record<number, string> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player.nickname?.trim().length ? player.nickname : player.name;
  }

  // If useSeparateLineForNames is true, format each group like:
  // Group 1:
  //     Player 1
  //     Player 2
  //
  // Group 2:
  //     Player 3
  //     Player 4
  //
  // Note: the extra newline for spacing between groups. If false, format like:
  // Group 1: Player 1, Player 2

  const groupLines = groups.map((group, index) => {
    const names = group.player_ids.map((id) => playerMap[id] || `Unknown(${id})`);
    const groupHeader = `Group ${index + 1}:`;

    if (useSeparateLineForNames) {
      return `${groupHeader}\n\u00A0\u00A0\u00A0\u00A0${names.join('\n\u00A0\u00A0\u00A0\u00A0')}`;
    }

    return `${groupHeader} ${names.join(', ')}`;
  });

  return groupLines.join(useSeparateLineForNames ? '\n\n' : '\n');
}

/**
 * Convert groups of player IDs into array of mobile phone number strings
 * suitable for texting.
 *
 * @param groups - Array of groups (each a list of player IDs)
 * @param allPlayers - Array of all Player objects
 * @param excludePlayerId - Optional player ID to exclude from the phone number list
 * @returns string[] - Array of mobile phone numbers'
 */
export function getMobilePhoneNumbersForGroups(
  groups: GroupPlayers[],
  allPlayers: Player[],
  excludePlayerId: number,
): string[] {
  const playerMap: Record<number, Player> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player;
  }

  const mobileNumbers = groups.map((group) =>
    group.player_ids
      .map((id) => {
        const player = playerMap[id];
        if (!player || player.id === excludePlayerId) return '';
        return player.mobile_number;
      })
      .filter((num) => num && num.length > 0),
  );
  const mergedNumbers = mobileNumbers.flat();
  //console.log('getMobilePhoneNumbers: ', mergedNumbers);

  return mergedNumbers;
}

/**
 * Convert groups of player IDs into groups of `email1,email2,email3...` strings
 * suitable for mailto links.
 *
 * @param groups - Array of groups (each a list of player IDs)
 * @param allPlayers - Array of all Player objects to consider
 * @param excludePlayerId - Optional player ID to exclude from the email list
 * @param emailAllPlayers - When true, email all players; when false, email only players in groups
 * @returns string - Merged email addresses separated by commas
 */
export function assembleEmailAddresses(
  groups: GroupPlayers[],
  allPlayers: Player[],
  excludePlayerId: number | null = null,
  emailAllPlayers: boolean = false,
): string {
  const playerMap: Record<number, Player> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player;
  }

  let playerIds: number[] = [];
  if (emailAllPlayers) {
    // Use all active league players
    playerIds = allPlayers.map((p) => p.id);
  } else {
    // Use only players in the groups (current behavior)
    playerIds = groups
      .flatMap((group) => group.player_ids)
      .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
  }

  const mailtoStrings = playerIds
    .map((id) => {
      const player = playerMap[id];
      if (!player || (excludePlayerId !== null && player.id === excludePlayerId)) return '';
      return player.email;
    })
    .filter((email) => email && email.length > 0)
    .join(',');

  return mailtoStrings;
}

/**
 * Helper function to copy the email body to clipboard as a backup.
 * This is useful for email clients (like Yahoo Mail) that have limitations with CC fields.
 *
 * @param body - Email body text
 */
async function copyBodyToClipboard(body: string): Promise<void> {
  if (!body) return;

  await Clipboard.setStringAsync(body).catch(() => {
    // silently fail if clipboard access is not available
  });
}

/**
 * Build a mailto URI with optional CC field support.
 *
 * @param addresses - Comma-separated email addresses
 * @param subject - Email subject
 * @param body - Email body
 * @param useCC - If true, put first address in 'to' and rest in 'cc'
 * @returns string - Complete mailto URI
 */
export function buildMailtoUri(
  addresses: string,
  subject: string,
  body: string,
  useCC: boolean = false,
): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  const emailArray = addresses
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (emailArray.length === 0) {
    return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  }

  if (!useCC || emailArray.length === 1) {
    if (emailArray.length === 1) {
      // Single recipient: address in the path — universally supported by all clients.
      return `mailto:${emailArray[0]}?subject=${encodedSubject}&body=${encodedBody}`;
    }
    // Multiple recipients, no CC: use ?to= with each address individually encoded
    // and joined by literal commas (not %2C). Outlook for Android treats comma-
    // separated path addresses as To+CC, so ?to= is required here. Encoding each
    // address individually escapes special chars while keeping commas as separators,
    // allowing Outlook to parse the full query string (including body) correctly.
    const toParam = emailArray.map((addr) => encodeURIComponent(addr)).join(',');
    return `mailto:?to=${toParam}&subject=${encodedSubject}&body=${encodedBody}`;
  }

  // CC format: single address in path, rest in 'cc' query param with per-address encoding
  const toPath = emailArray[0];
  const ccParam = emailArray
    .slice(1)
    .map((addr) => encodeURIComponent(addr))
    .join(',');

  // copy email body to clipboard as a backup for Yahoo Mail limitation
  Clipboard.setStringAsync(body).catch(() => {
    // silently fail if clipboard access is not available
  });

  return `mailto:${toPath}?cc=${ccParam}&subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Compose and send an email using expo-mail-composer.
 *
 * @param addresses - Comma-separated email addresses
 * @param subject - Email subject
 * @param body - Email body
 * @param useCC - If true, put first address in 'to' and rest in 'cc'
 * @returns Promise<void>
 */
export async function composeEmail(
  addresses: string,
  subject: string,
  body: string,
  useCC: boolean = false,
): Promise<void> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    // Outlook for Android often doesn't register as the system default mail handler,
    // so isAvailableAsync() returns false even when Outlook is installed. Fall back
    // to Linking.openURL with a mailto: URI, which Outlook handles reliably.
    const uri = buildMailtoUri(addresses, subject, body, useCC);
    await Linking.openURL(uri);
    return;
  }

  const emailArray = addresses
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (!useCC || emailArray.length <= 1) {
    // Standard format: all addresses in 'recipients'
    await MailComposer.composeAsync({
      recipients: emailArray,
      subject,
      body,
    });
  } else {
    // CC format: first address in 'recipients', rest in 'ccRecipients'
    const ccRecipients = emailArray.slice(1);

    // Copy email body to clipboard as a backup for Yahoo Mail limitation
    await copyBodyToClipboard(body);

    await MailComposer.composeAsync({
      recipients: [emailArray[0]],
      ccRecipients,
      subject,
      body,
    });
  }
}

/**
 * Returns Ids of all GroupPlayers for a specific round.
 * @param roundId - The round ID to filter by.
 * @param groups - The list of Group objects.
 * @param groupPlayers - The list of GroupPlayers objects.
 * @returns An array of GroupPlayers belonging to that round.
 */
export function getGroupPlayerIdsByRoundId(
  roundId: number,
  groups: Group[],
  groupPlayers: GroupPlayers[],
): number[] {
  // Get all groups associated with the given round
  const roundGroupIds = groups.filter((group) => group.round_id === roundId).map((group) => group.id);

  // Filter groupPlayers that belong to those groups
  const groupsForRound = groupPlayers.filter((gp) => roundGroupIds.includes(gp.group_id));
  const groupPlayerIds = groupsForRound.flatMap((g) => g.player_ids);
  return groupPlayerIds;
}

/**
 * Returns all GroupPlayers for a specific round.
 * @param roundId - The round ID to filter by.
 * @param groups - The list of Group objects.
 * @param groupPlayers - The list of GroupPlayers objects.
 * @returns An array of GroupPlayers belonging to that round.
 */
export function getGroupPlayersByRoundId(
  roundId: number,
  groups: Group[],
  groupPlayers: GroupPlayers[],
): GroupPlayers[] {
  // Get all groups associated with the given round
  const roundGroupIds = groups.filter((group) => group.round_id === roundId).map((group) => group.id);

  // Filter groupPlayers that belong to those groups
  return groupPlayers.filter((gp) => roundGroupIds.includes(gp.group_id));
}

/**
 * Converts GroupPlayers into readable strings of player names.
 * @param groupPlayers - The GroupPlayers array (e.g., result of getGroupPlayersByRoundId).
 * @param players - The full list of Player objects.
 * @returns An array of strings, one per group.
 */
export function formatGroupPlayersByNames(groupPlayers: GroupPlayers[], players: Player[]): string[] {
  return groupPlayers.map((gp) => {
    const names = gp.player_ids
      .map((pid) => {
        const player = players.find((p) => p.id === pid);
        if (!player) return undefined;
        return player.nickname?.trim().length ? player.nickname : player.name;
      })
      .filter((name): name is string => Boolean(name)); // remove undefined

    return names.join(', ');
  });
}

/**
 * Ensures the active players exactly match the players in GroupPlayers.
 * Returns true only if:
 *  1. Every player_id in groupPlayers is in activePlayerIds, AND
 *  2. Every activePlayerId is found in some groupPlayers entry.
 *
 * @param groupPlayers - The groups and their assigned player IDs.
 * @param activePlayerIds - The currently active player IDs.
 * @returns true if both sets of IDs match exactly; false otherwise.
 */
export function groupPlayersMatchActivePlayers(
  groupPlayers: GroupPlayers[],
  activePlayerIds: number[],
): boolean {
  // Collect all unique player_ids from groupPlayers
  const groupPlayerIds = new Set<number>(groupPlayers.flatMap((gp) => gp.player_ids));

  // Check if both sets have the same size
  if (groupPlayerIds.size !== activePlayerIds.length) {
    return false;
  }

  // Check that every activePlayerId is in the group players
  for (const id of activePlayerIds) {
    if (!groupPlayerIds.has(id)) {
      return false;
    }
  }
  return true;
}

/**
 * Generate a player nickname from a full name string.
 *
 * Example:
 *   'John Doe'        → 'John D'
 *   'Mary Jane Smith' → 'Mary S'
 *   'Cher'            → 'Cher'
 *   '  Carlos   Ruiz  ' → 'Carlos R'
 */
export function generateNickname(fullName: string): string {
  if (!fullName) return '';

  // Trim and split by whitespace
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) return '';

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  if (parts.length === 1) {
    // Single word name — just return it
    return firstName;
  }

  // Use first name + first initial of last name
  const initial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${initial}`;
}

/**
 * Converts a phone number string into E.164 format.
 *
 * Rules:
 * - Keeps leading '+' if present.
 * - Removes all other non-digit characters.
 * - Does NOT prepend '+1' automatically unless already in input.
 * - Useful for storing a normalized number in the database.
 *
 * Examples:
 *   "+1 (415) 555-1234" → "+14155551234"
 *   "415-555-1234"       → "4155551234"
 *   "555-1234"           → "5551234"
 */
export function formatPhoneNumberToE164(input: string): string {
  if (!input) return '';

  // Trim and remove all non-digit/non-plus characters
  const cleaned = input.trim().replace(/[^\d+]/g, '');

  // Keep leading '+' if present
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  // Otherwise, return only digits
  return cleaned.replace(/\D/g, '');
}

/**
 * Convert an E.164 phone number (e.g., "+14155551234") into a readable format.
 *
 * Examples:
 *   "+14155551234"  → "+1(415)555-1234"
 *   "+442071838750" → "+44 2071838750"
 *   "+15551234"     → "+1 555-1234"
 *   "4155551234"    → "(415)555-1234"
 */
export function displayPhoneNumberFromE164(e164: string): string {
  if (!e164) return '';

  // Normalize input
  const cleaned = e164.trim();

  // Must start with '+', otherwise treat as raw local number
  if (!cleaned.startsWith('+')) {
    // Fallback for local format
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  // Extract country code and rest of number
  const match = cleaned.match(/^\+(\d{1,3})(\d*)$/);
  if (!match) return cleaned;

  const [, countryCode, rest] = match;

  // US/Canada
  if (countryCode === '1' && rest.length === 10) {
    return `+1(${rest.slice(0, 3)})${rest.slice(3, 6)}-${rest.slice(6)}`;
  }

  // US/Canada with 7-digit local number (rare case)
  if (countryCode === '1' && rest.length === 7) {
    return `+1 ${rest.slice(0, 3)}-${rest.slice(3)}`;
  }

  // Other international numbers — group digits for readability
  const grouped = rest.replace(/(\d{2,3})(?=\d)/g, '$1').trim();
  return `+${countryCode} ${grouped}`;
}
