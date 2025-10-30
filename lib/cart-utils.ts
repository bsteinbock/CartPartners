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
  manuallySpecified?: number[];
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
 * - Use a manually specified first group
 */
export function generateNextRoundGroups(params: Partial<GroupParams>): number[][] {
  // --- ✅ Safely unpack parameters with defaults ---
  const {
    playerIds = [],
    partnerFrequencies = {},
    allPlayers,
    fairnessWeight = 1.0,
    shuffle = true,
    avoidSlowPairs = false,
    slowThreshold = 4,
    manuallySpecified,
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

  const getSpeedIndex = (id: number): number => allPlayers?.find((p) => p.id === id)?.speedIndex ?? 0;

  // --- ✅ Handle manually specified first group ---
  if (manuallySpecified && manuallySpecified.length > 0) {
    const expectedSize = groupSizes[0];
    if (manuallySpecified.length !== expectedSize) {
      throw new Error(
        `manuallySpecified group must have exactly ${expectedSize} players (got ${manuallySpecified.length}).`,
      );
    }

    // Remove specified players from remaining pool
    for (const id of manuallySpecified) {
      const idx = remainingPlayers.indexOf(id);
      if (idx !== -1) remainingPlayers.splice(idx, 1);
    }

    groups.push([...manuallySpecified]);
  }

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
      .map((pid) => players.find((p) => p.id === pid)?.name)
      .filter((name): name is string => Boolean(name)); // filter out undefined

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
    playerMap[player.id] = player.name;
  }

  return groups
    .map((group, index) => {
      const names = group.player_ids.map((id) => playerMap[id] || `Unknown(${id})`);
      return `Group ${index + 1}: ${names.join(', ')}`;
    })
    .join('\n');
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
        return player ? `${player.name} <${player.email}>` : `Unknown(${id})`;
      })
      .join(', '),
  );
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
      .map((pid) => players.find((p) => p.id === pid)?.name)
      .filter((name): name is string => Boolean(name)); // filter out undefined

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
