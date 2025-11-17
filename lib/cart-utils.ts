// utils.ts
import { Group, GroupPlayers, ManualGroupList, Player } from '../hooks/use-dbStore';

/**
 * @param playerIds - The list of players for the next round
 * @param partnerFrequencies - Output from buildPlayingPartnerFrequencies()
 * @param allPlayers -  Player info for speedIndex
 * @param avoidSlowPairs - avoid pairing slow players (default true)
 * @param slowThreshold - Speed index threshold for being "slow" (default 4)
 * @param fairnessWeight - How strongly to favor players with fewer unique
 *                         partners 0=ignore >2 strong prioritization (default: 1.0)
 * @param shuffle - Whether to shuffle the player list (default true)
 */
export interface GroupParams {
  playerIds: number[];
  partnerFrequencies: Record<number, Record<number, number>>;
  allPlayers?: Player[];
  fairnessWeight?: number;
  shuffle?: boolean;
  avoidSlowPairs?: boolean;
  slowThreshold?: number;
}

export function getGroupSizes(numPlayers: number): number[] {
  if (numPlayers <= 0) return [];
  if (numPlayers <= 4) return [numPlayers];
  if (numPlayers === 5) return [3, 2];
  if (numPlayers === 6) return [3, 3];
  if (numPlayers === 9) return [3, 3, 3];

  const groups: number[] = [];
  let remaining = numPlayers;

  while (remaining > 0) {
    if (remaining % 4 === 0) {
      groups.push(4);
      remaining -= 4;
    } else if (remaining % 4 === 1) {
      // Instead of ending with a group of 1, replace one 4 with two 3s
      if (groups.length > 0 && groups[groups.length - 1] === 4) {
        groups.pop();
        groups.push(3, 3);
        remaining -= 1; // because we used one less total
      } else {
        groups.push(3);
        remaining -= 3;
      }
    } else if (remaining % 4 === 2) {
      // avoid a final 2 by using a 3 first if possible
      if (remaining > 6) {
        groups.push(3);
        remaining -= 3;
      } else {
        groups.push(4, 4); // e.g., for 8 players left
        remaining -= 8;
      }
    } else if (remaining % 4 === 3) {
      groups.push(3);
      remaining -= 3;
    } else {
      groups.push(4);
      remaining -= 4;
    }
  }

  return groups;
}

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

/**
 * Generate new groups for the next round, with optional constraints like:
 * - Avoid multiple "slow" players (speedIndex > slowThreshold)
 */
export function generateNextRoundGroups(params: Partial<GroupParams>): number[][] {
  // --- ✅ Safely unpack parameters with defaults ---
  const {
    playerIds = [], // list of player IDs to group
    partnerFrequencies = {}, // Map of playerId → { partnerId → timesPlayedTogether }
    allPlayers, // needed to lookup speed index
    fairnessWeight = 1.0,
    shuffle = true, // this promotes different starting groups between rounds
    avoidSlowPairs = true, // try to avoid having a very slow group
    slowThreshold = 4, // any speed value above this is considered slow.
  } = params;

  if (!playerIds.length) {
    throw new Error('generateNextRoundGroups: playerIds array is required.');
  }

  if (!partnerFrequencies) {
    throw new Error('generateNextRoundGroups: partnerFrequencies map is required.');
  }

  // --- Determine group sizes ---
  const groupSizes = getGroupSizes(playerIds.length);
  const remainingPlayers = shuffle ? [...playerIds].sort(() => Math.random() - 0.5) : [...playerIds];
  const groups: number[][] = [];

  // --- function to get player speed index
  const getSpeedIndex = (id: number): number => allPlayers?.find((p) => p.id === id)?.speedIndex ?? 0;

  // --- Build remaining groups automatically ---
  for (let i = groups.length; i < groupSizes.length; i++) {
    const size = groupSizes[i];
    if (remainingPlayers.length === 0) break;

    const starter = getLeastConnectedPlayer(remainingPlayers, partnerFrequencies);
    const group = [starter];
    remainingPlayers.splice(remainingPlayers.indexOf(starter), 1);

    while (group.length < size && remainingPlayers.length > 0) {
      const nextPlayer = getBestNextPartnerWithFairnessAndSpeedLimit(
        group,
        remainingPlayers,
        partnerFrequencies,
        fairnessWeight,
        avoidSlowPairs,
        slowThreshold,
        getSpeedIndex,
      );
      group.push(nextPlayer);
      remainingPlayers.splice(remainingPlayers.indexOf(nextPlayer), 1);
    }

    groups.push(group);
  }

  // --- Handle leftover players ---
  for (const leftover of remainingPlayers) {
    let bestGroup = groups[0];
    let minConflicts = Infinity;

    for (const group of groups) {
      const conflicts = group.reduce((sum, member) => sum + (partnerFrequencies[leftover]?.[member] || 0), 0);
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestGroup = group;
      }
    }

    bestGroup.push(leftover);
  }

  // --- Additional pass to reduce slow-player clustering when requested ---
  if (avoidSlowPairs) {
    // compute slow counts per group
    const slowCounts = groups.map((g) => g.filter((id) => getSpeedIndex(id) > slowThreshold).length);

    // For any group with more than one slow player, try swaps that both reduce slow clustering
    // and minimize repeated pairings (using partnerFrequencies).
    for (let i = 0; i < groups.length; i++) {
      // keep trying until this group has at most 1 slow player or no candidates remain
      while (slowCounts[i] > 1) {
        let performedSwap = false;

        // find a slow player in group i to consider moving
        const slowPlayerIdx = groups[i].findIndex((id) => getSpeedIndex(id) > slowThreshold);
        if (slowPlayerIdx === -1) break;
        const slowPlayerId = groups[i][slowPlayerIdx];

        let bestSwap: {
          targetGroupIndex: number;
          targetMemberIndex: number;
          totalConflict: number;
        } | null = null;

        // Evaluate possible swaps across all other groups
        for (let j = 0; j < groups.length; j++) {
          if (j === i) continue;

          // prefer groups with fewer slow players (but still allow others if beneficial)
          // iterate candidates in group j who are not slow
          for (let candidateIdx = 0; candidateIdx < groups[j].length; candidateIdx++) {
            const candidateId = groups[j][candidateIdx];
            if (getSpeedIndex(candidateId) > slowThreshold) continue; // don't swap with another slow

            // compute conflict score if slowPlayer moved into group j (excluding candidate)
            let conflictSlowNew = 0;
            for (const m of groups[j]) {
              if (m === candidateId) continue;
              conflictSlowNew += partnerFrequencies[slowPlayerId]?.[m] || 0;
            }

            // compute conflict score for candidate moved into group i (excluding slowPlayer)
            let conflictCandidateNew = 0;
            for (const m of groups[i]) {
              if (m === slowPlayerId) continue;
              conflictCandidateNew += partnerFrequencies[candidateId]?.[m] || 0;
            }

            const totalConflict = conflictSlowNew + conflictCandidateNew;

            // Only consider swaps that tend to improve slow distribution:
            // prefer swaps where target group slow count is strictly less than source,
            // or that at least reduces the max slow count between the two groups.
            const newSlowCountSource =
              groups[i].filter((id) => id !== slowPlayerId && getSpeedIndex(id) > slowThreshold).length +
              (getSpeedIndex(candidateId) > slowThreshold ? 1 : 0);
            const newSlowCountTarget =
              groups[j].filter((id) => id !== candidateId && getSpeedIndex(id) > slowThreshold).length +
              (getSpeedIndex(slowPlayerId) > slowThreshold ? 1 : 0);

            // only accept swaps that don't make target worse than source currently is
            if (newSlowCountTarget > slowCounts[i]) continue;

            if (
              !bestSwap ||
              // prefer groups with fewer current slows, then lower conflict
              slowCounts[j] < slowCounts[bestSwap.targetGroupIndex] ||
              (slowCounts[j] === slowCounts[bestSwap.targetGroupIndex] &&
                totalConflict < bestSwap.totalConflict)
            ) {
              bestSwap = { targetGroupIndex: j, targetMemberIndex: candidateIdx, totalConflict };
            }
          }
        }

        if (bestSwap) {
          const j = bestSwap.targetGroupIndex;
          const candidateIdx = bestSwap.targetMemberIndex;
          const candidateId = groups[j][candidateIdx];

          // perform swap
          groups[i][slowPlayerIdx] = candidateId;
          groups[j][candidateIdx] = slowPlayerId;

          // update slowCounts
          slowCounts[i] = groups[i].filter((id) => getSpeedIndex(id) > slowThreshold).length;
          slowCounts[j] = groups[j].filter((id) => getSpeedIndex(id) > slowThreshold).length;

          performedSwap = true;
        }

        // if no suitable swap found, break to avoid infinite loop
        if (!performedSwap) break;
      }
    }
  }

  return groups;
}

/**
 * Helper for selecting the best next player while respecting fairness and slow-player rules.
 */
function getBestNextPartnerWithFairnessAndSpeedLimit(
  currentGroup: number[],
  candidates: number[],
  partnerFrequencies: Record<number, Record<number, number>>,
  fairnessWeight: number,
  avoidSlowPairs: boolean,
  slowThreshold: number,
  getSpeedIndex: (id: number) => number,
): number {
  let bestPlayer = candidates[0];
  let lowestScore = Infinity;

  const hasSlowPlayer = avoidSlowPairs && currentGroup.some((id) => getSpeedIndex(id) > slowThreshold);

  for (const candidate of candidates) {
    const candidateIsSlow = getSpeedIndex(candidate) > slowThreshold;
    if (avoidSlowPairs && hasSlowPlayer && candidateIsSlow) continue;

    let repeatScore = 0;
    for (const member of currentGroup) {
      repeatScore += partnerFrequencies[candidate]?.[member] || 0;
    }

    const uniquePartners = Object.keys(partnerFrequencies[candidate] || {}).length;
    const fairnessScore = uniquePartners * fairnessWeight;

    const totalScore = repeatScore + fairnessScore;

    if (totalScore < lowestScore) {
      lowestScore = totalScore;
      bestPlayer = candidate;
    }
  }

  return bestPlayer;
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
 * Utility to find the least-connected player overall (fewest repeat partners).
 */
function getLeastConnectedPlayer(
  playerIds: number[],
  partnerFrequencies: Record<number, Record<number, number>>,
): number {
  let minScore = Infinity;
  let bestPlayer = playerIds[0];

  for (const id of playerIds) {
    const partners = partnerFrequencies[id] || {};
    const totalInteractions = Object.values(partners).reduce((a, b) => a + b, 0);
    if (totalInteractions < minScore) {
      minScore = totalInteractions;
      bestPlayer = id;
    }
  }

  return bestPlayer;
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
 * @returns string - Formatted report showing each group with player names
 */
export function reportGroupsWithNames(groups: GroupPlayers[], allPlayers: Player[]): string {
  const playerMap: Record<number, string> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player.nickname?.trim().length ? player.nickname : player.name;
  }

  return groups
    .map((group, index) => {
      const names = group.player_ids.map((id) => playerMap[id] || `Unknown(${id})`);
      return `Group ${index + 1}: ${names.join(', ')}`;
    })
    .join('\n');
}

/**
 * Convert groups of player IDs into array of mobile phone number strings
 * suitable for texting.
 *
 * @param groups - Array of groups (each a list of player IDs)
 * @param allPlayers - Array of all Player objects
 * @returns string[] - Array of mobile phone numbers'
 */
export function getMobilePhoneNumbersForGroups(groups: GroupPlayers[], allPlayers: Player[]): string[] {
  const playerMap: Record<number, Player> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player;
  }

  const mobileNumbers = groups.map((group) =>
    group.player_ids
      .map((id) => {
        const player = playerMap[id];
        if (!player) return '';
        return player.mobile_number;
      })
      .filter((num) => num && num.length > 0),
  );
  const mergedNumbers = mobileNumbers.flat();
  //console.log('getMobilePhoneNumbers: ', mergedNumbers);

  return mergedNumbers;
}

/**
 * Convert groups of player IDs into groups of `name<email>` strings
 * suitable for mailto links.
 *
 * @param groups - Array of groups (each a list of player IDs)
 * @param allPlayers - Array of all Player objects
 * @returns string[] - Array of strings, one per group, formatted as 'Name <email>, ...'
 */
export function getMailtoStrings(groups: GroupPlayers[], allPlayers: Player[]): string[] {
  const playerMap: Record<number, Player> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player;
  }

  return groups.map((group) =>
    group.player_ids
      .map((id) => {
        const player = playerMap[id];
        if (!player) return `Unknown(${id})`;
        const displayName = player.nickname?.trim().length ? player.nickname : player.name;
        return `${displayName} <${player.email}>`;
      })
      .join(', '),
  );
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
