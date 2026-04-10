// utils.ts
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
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
 * Given a list of player IDs, return the corresponding Player objects.
 * @param playerIds - Array of player IDs from group specification
 * @param players - Array of all Player objects
 * @returns Array of Player objects matching the given IDs
 */
export function getPlayerForGroup(playerIds: number[], players: Player[]): Player[] {
  return playerIds.map((pid) => players.find((p) => p.id === pid)).filter((p): p is Player => Boolean(p)); // filter out undefined
}

/**
 * Generate groups for a round, with optional constraints like:
 * - Avoid multiple "slow" players (speedIndex > slowThreshold)
 */
export function generateGroupsForRound(params: Partial<GroupParams>): number[][] {
  const {
    playerIds = [],
    partnerFrequencies = {},
    allPlayers,
    fairnessWeight = 1.0,
    shuffle = true,
    avoidSlowPairs = true,
    slowThreshold = 4,
  } = params;

  if (!playerIds.length) throw new Error('generateGroupsForRound: playerIds array is required.');

  // precompute helper maps to avoid repeated work
  const uniquePartnerCounts: Record<number, number> = {};
  const totalInteractions: Record<number, number> = {};
  for (const id of playerIds) {
    const map = partnerFrequencies[id] || {};
    uniquePartnerCounts[id] = Object.keys(map).length;
    totalInteractions[id] = Object.values(map).reduce((s, v) => s + v, 0);
  }

  const groupSizes = getGroupSizes(playerIds.length);
  const remainingPlayers = shuffle ? [...playerIds].sort(() => Math.random() - 0.5) : [...playerIds];
  const groups: number[][] = [];

  const speedCache: Record<number, number> = {};
  const getSpeedIndex = (id: number) => {
    if (speedCache[id] !== undefined) return speedCache[id];
    const val = allPlayers?.find((p) => p.id === id)?.speedIndex ?? 0;
    speedCache[id] = val;
    return val;
  };

  // Build groups
  for (let gi = 0; gi < groupSizes.length; gi++) {
    const size = groupSizes[gi];
    if (remainingPlayers.length === 0) break;

    // pick starter (least connected among remaining)
    const starter = getLeastConnectedPlayer(remainingPlayers, partnerFrequencies, totalInteractions);
    const group: number[] = [starter];
    remainingPlayers.splice(remainingPlayers.indexOf(starter), 1);

    // Prepare incremental candidate scores for the remainingPlayers
    // score = initial fairness component (unique partner count * fairnessWeight) + cumulative repeat interactions with current group
    const candidateScores: Record<number, number> = {};
    for (const c of remainingPlayers) {
      candidateScores[c] = (uniquePartnerCounts[c] || 0) * fairnessWeight;
      // no repeat interactions yet, will update when group grows
    }

    // add starter effect: update candidate scores by starter interactions
    for (const c of remainingPlayers) {
      candidateScores[c] += partnerFrequencies[c]?.[starter] ?? 0;
    }

    while (group.length < size && remainingPlayers.length > 0) {
      // choose best candidate (lowest score) respecting slow-player constraints
      let bestCandidate: number | null = null;
      let bestScore = Infinity;
      const groupHasSlow = avoidSlowPairs && group.some((id) => getSpeedIndex(id) > slowThreshold);

      for (const candidate of remainingPlayers) {
        const candidateIsSlow = getSpeedIndex(candidate) > slowThreshold;
        if (avoidSlowPairs && groupHasSlow && candidateIsSlow) continue; // skip if would create slow cluster

        const score = candidateScores[candidate];
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      // if no candidate found due to slow constraints, relax and pick minimum score
      if (bestCandidate === null) {
        for (const candidate of remainingPlayers) {
          const score = candidateScores[candidate];
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
          }
        }
      }

      if (bestCandidate == null) break;

      // select bestCandidate
      group.push(bestCandidate);
      remainingPlayers.splice(remainingPlayers.indexOf(bestCandidate), 1);

      // update candidateScores: for each remaining candidate c, add partnerFrequencies[c][bestCandidate]
      for (const c of remainingPlayers) {
        candidateScores[c] += partnerFrequencies[c]?.[bestCandidate] ?? 0;
      }
    }

    groups.push(group);
  }

  // assign any leftover players to groups minimizing partner conflicts (same as before)
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

  // optional slow-cluster pass (simple, fast)
  if (avoidSlowPairs) {
    simpleSlowClusterAdjustment(groups, partnerFrequencies, getSpeedIndex, slowThreshold);
  }

  return groups;
}

/**
 * Utility to find the least-connected player overall (fewest repeat partners).
 */
function getLeastConnectedPlayer(
  playerIds: number[],
  partnerFrequencies: Record<number, Record<number, number>>,
  precomputedTotals?: Record<number, number>,
): number {
  // precomputedTotals: sum of interactions for each player (if provided)
  let minScore = Infinity;
  let best = playerIds[0];

  for (const id of playerIds) {
    const score = precomputedTotals
      ? (precomputedTotals[id] ?? 0)
      : Object.values(partnerFrequencies[id] || {}).reduce((a, b) => a + b, 0);
    if (score < minScore) {
      minScore = score;
      best = id;
    }
  }
  return best;
}

/**
 * Simple slow-cluster adjustment:
 * - For groups with >1 slow players, try to swap extras with groups that have 0 slow players.
 * - Only accept a swap if the partner-repeat "cost" does not increase.
 * - Conservative, fast, and optional post-process step.
 */
/**
 * Post-process to reduce "slow player" clustering across groups.
 *
 * Behavior summary
 * - Inputs:
 *   - `groups`: array of groups (each an array of player IDs). This function mutates the array in-place.
 *   - `partnerFrequencies`: map playerId -> (partnerId -> times played together). Used as a cost metric.
 *   - `getSpeedIndex(id)`: accessor returning numeric speedIndex for a player id.
 *   - `slowThreshold`: numeric threshold above which a player is considered "slow".
 *   - `slowSwapCostTolerance` (optional, default=1): allow small increases in partner-repeat cost when performing a swap.
 *
 * - Goal: minimize the number of groups that contain more than one slow player (i.e. reduce "extra" slows
 *   beyond one per group) while avoiding large increases in partner-repeat cost (players meeting again).
 *
 * - Algorithm (greedy, local swaps):
 *   1. Compute `slowCount` per group (how many slow players each group contains).
 *   2. Repeatedly search for the single best swap of a slow player in a "source" group (where slowCount>1)
 *      with a non-slow player from any other "target" group that:
 *        - reduces the combined "extra slow" metric for the two groups (deltaExtra < 0), and
 *        - produces a partner-repeat `swappedCost` that is <= `currentCost + slowSwapCostTolerance`.
 *   3. The best swap is chosen by preferring (in order): larger reduction in extra-slow metric, then
 *      smaller increase in partner-repeat cost.
 *   4. Apply the swap and update `slowCount`; repeat until no improving swap is found.
 *
 * - Acceptance criteria: conservative by default — only swaps that reduce extra-slow count are considered,
 *   and cost increases are bounded by `slowSwapCostTolerance`. This prevents making swaps that alleviate
 *   slow clustering at the expense of greatly increasing repeat partners.
 *
 * - Complexity: this is an O(G^2 * P) search per iteration (G = #groups, P = avg players per group) and
 *   typically converges quickly because it performs only improving swaps.
 *
 * - Side effects: mutates `groups` in-place and returns the same array for convenience.
 */
function simpleSlowClusterAdjustment(
  groups: number[][],
  partnerFrequencies: Record<number, Record<number, number>>,
  getSpeedIndex: (id: number) => number,
  slowThreshold: number,
  slowSwapCostTolerance = 1,
): number[][] {
  if (!groups || groups.length < 2) return groups;

  const isSlow = (id: number) => getSpeedIndex(id) > slowThreshold;

  // Helper: sum of partner repeats between player and members of a group
  const groupConflictCost = (player: number, group: number[]) =>
    group.reduce((sum, m) => sum + (partnerFrequencies[player]?.[m] ?? 0), 0);

  // track slow counts per group
  const slowCount = groups.map((g) => g.filter(isSlow).length);
  //console.log('Initial slow counts per group:', slowCount);

  // metric: how many "extra" slow players exist beyond 1 per group (computed inline where needed)
  let improved = true;
  while (improved) {
    improved = false;

    // collect candidate source groups (those with >1 slow)
    const sources = slowCount.map((c, i) => (c > 1 ? i : -1)).filter((i) => i >= 0);

    // best swap tracked across all candidates
    let bestSwap: {
      srcIdx: number;
      tgtIdx: number;
      slowPlayer: number;
      nonSlowPlayer: number;
      deltaExtra: number;
      currentCost: number;
      swappedCost: number;
    } | null = null;

    for (const srcIdx of sources) {
      const srcGroup = groups[srcIdx];
      const slowPlayers = srcGroup.filter(isSlow);

      for (const slowPlayer of slowPlayers) {
        for (let tgtIdx = 0; tgtIdx < groups.length; tgtIdx++) {
          if (tgtIdx === srcIdx) continue;
          const tgtGroup = groups[tgtIdx];
          const nonSlowCandidates = tgtGroup.filter((p) => !isSlow(p));
          if (nonSlowCandidates.length === 0) continue;

          for (const nonSlowPlayer of nonSlowCandidates) {
            // predicted slow counts after swap
            const srcNew = slowCount[srcIdx] - 1;
            const tgtNew = slowCount[tgtIdx] + 1;

            const beforeExtra = Math.max(0, slowCount[srcIdx] - 1) + Math.max(0, slowCount[tgtIdx] - 1);
            const afterExtra = Math.max(0, srcNew - 1) + Math.max(0, tgtNew - 1);
            const deltaExtra = afterExtra - beforeExtra; // negative means improvement

            // compute cost before and after swap
            const currentCost =
              groupConflictCost(
                slowPlayer,
                srcGroup.filter((m) => m !== slowPlayer),
              ) +
              groupConflictCost(
                nonSlowPlayer,
                tgtGroup.filter((m) => m !== nonSlowPlayer),
              );

            const swappedCost =
              groupConflictCost(
                nonSlowPlayer,
                srcGroup.filter((m) => m !== slowPlayer),
              ) +
              groupConflictCost(
                slowPlayer,
                tgtGroup.filter((m) => m !== nonSlowPlayer),
              );

            // Prefer swaps that reduce the extraSlowMetric (deltaExtra < 0).
            // Allow small increases in partner-repeat cost up to `slowSwapCostTolerance`.
            if (deltaExtra < 0 && swappedCost <= currentCost + slowSwapCostTolerance) {
              if (
                !bestSwap ||
                deltaExtra < bestSwap.deltaExtra ||
                (deltaExtra === bestSwap.deltaExtra &&
                  swappedCost - currentCost < bestSwap.swappedCost - bestSwap.currentCost)
              ) {
                bestSwap = {
                  srcIdx,
                  tgtIdx,
                  slowPlayer,
                  nonSlowPlayer,
                  deltaExtra,
                  currentCost,
                  swappedCost,
                };
              }
            }
          }
        }
      }
    }

    // If we found a beneficial swap, perform it and loop again
    if (bestSwap) {
      const { srcIdx, tgtIdx, slowPlayer, nonSlowPlayer } = bestSwap;
      const srcPos = groups[srcIdx].indexOf(slowPlayer);
      const tgtPos = groups[tgtIdx].indexOf(nonSlowPlayer);
      if (srcPos >= 0 && tgtPos >= 0) {
        groups[srcIdx][srcPos] = nonSlowPlayer;
        groups[tgtIdx][tgtPos] = slowPlayer;

        slowCount[srcIdx] = Math.max(0, slowCount[srcIdx] - 1);
        slowCount[tgtIdx] = slowCount[tgtIdx] + 1;

        improved = true;
      }
    }
  }

  //const finalSlowCount = groups.map((g) => g.filter(isSlow).length);
  //console.log('Final slow counts per group:', finalSlowCount);

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

  return groups
    .map((group, index) => {
      const names = group.player_ids.map((id) => playerMap[id] || `Unknown(${id})`);
      const groupHeader = `Group ${index + 1}:`;
      const groupString = useSeparateLineForNames
        ? `${groupHeader}\n    ${names.join('\n    ')}`
        : `${groupHeader} ${names.join(', ')}`;

      return groupString;
    })
    .join('\n');
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
 * @param allPlayers - Array of all Player objects
 * @param excludePlayerId - Optional player ID to exclude from the email list
 * @returns string - Merged email addresses separated by commas
 */
export function getMailtoString(
  groups: GroupPlayers[],
  allPlayers: Player[],
  excludePlayerId: number | null = null,
): string {
  const playerMap: Record<number, Player> = {};
  for (const player of allPlayers) {
    playerMap[player.id] = player;
  }

  const mailtoStrings = groups
    .map((group) =>
      group.player_ids
        .map((id) => {
          const player = playerMap[id];
          if (!player || (excludePlayerId !== null && player.id === excludePlayerId)) return '';
          return player.email;
        })
        .filter((email) => email && email.length > 0)
        .join(','),
    )
    .join(',');

  return mailtoStrings;
}

/**
 * Helper function to copy CC recipients to clipboard as a backup.
 * This is useful for email clients (like Yahoo Mail) that have limitations with CC fields.
 *
 * @param ccRecipients - Array of CC recipient email addresses
 */
async function copyccRecipientsToClipboard(ccRecipients: string[]): Promise<void> {
  if (ccRecipients.length === 0) return;

  const ccArrayString = ccRecipients.join(',');
  await Clipboard.setStringAsync(ccArrayString).catch(() => {
    // silently fail if clipboard access is not available
  });
}

/**
 * Build a mailto URI with optional CC field support.
 *
 * @deprecated Use composeEmail() instead for better native email composer integration
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

  if (!useCC) {
    // Standard format: all addresses in 'to'
    const encodedAddresses = encodeURIComponent(addresses);
    return `mailto:?to=${encodedAddresses}&subject=${encodedSubject}&body=${encodedBody}`;
  }

  // CC format: first address in 'to', rest in 'cc'
  const emailArray = addresses
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (emailArray.length === 0) {
    return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  }

  if (emailArray.length === 1) {
    const encodedTo = encodeURIComponent(emailArray[0]);
    return `mailto:?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
  }

  // Multiple addresses: first in 'to', rest in 'cc'
  const encodedTo = encodeURIComponent(emailArray[0]);
  const ccArrayString = emailArray.slice(1).join(',');
  const encodedCC = encodeURIComponent(ccArrayString);

  // add ccArrayString to clipboard as a backup for Yahoo Mail limitation
  Clipboard.setStringAsync(ccArrayString).catch(() => {
    // silently fail if clipboard access is not available
  });

  return `mailto:?to=${encodedTo}&cc=${encodedCC}&subject=${encodedSubject}&body=${encodedBody}`;
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
    throw new Error('Mail composer is not available on this device');
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

    // Copy CC recipients to clipboard as a backup for Yahoo Mail limitation
    await copyccRecipientsToClipboard(ccRecipients);

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
