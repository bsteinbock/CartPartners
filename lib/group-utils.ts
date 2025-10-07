import { Player } from './db-helper';

export type Group = { players: Player[] };

function getSpeedStdDev(players: Player[]): number {
  const speeds = players.map((p) => p.speedIndex);
  const mean = speeds.reduce((sum, val) => sum + val, 0) / speeds.length;
  const variance = speeds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / speeds.length;
  return Math.sqrt(variance);
}

// In pickBestGroup, we now use speedIndex balance in scoring
function pickBestGroup(
  candidates: Player[],
  size: number,
  pairFrequency: Map<string, number>,
  recentGroups: Group[],
  speedWeight: number = 1, // <-- weighting for speed balance
): Player[] {
  const combinations = getCombinations(candidates, size);

  let bestGroup: Player[] = [];
  let bestScore = Infinity;

  for (const group of combinations) {
    const ids = group.map((p) => p.id ?? 0).sort();

    // Avoid exact repeats
    const isInRecent = recentGroups.some((recent) => {
      const recentIds = recent.players.map((p) => p.id ?? 0).sort();
      return arraysEqual(ids, recentIds);
    });

    if (isInRecent) continue;

    // Score repeat pairings
    let pairScore = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('-');
        pairScore += pairFrequency.get(key) || 0;
      }
    }

    // Score speed variance
    const speedStdDev = getSpeedStdDev(group);

    // Total score
    const totalScore = pairScore + speedWeight * speedStdDev;

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestGroup = group;
    }
  }

  return bestGroup.length > 0 ? bestGroup : combinations[0];
}

export function createCartGroupings(activePlayers: Player[], recentGroups: Group[]): Group[] {
  if (activePlayers.length === 0) return [];

  const proposedGroups: Group[] = [];

  // Step 1: Build a map of pair frequencies from recent groups
  const pairFrequency: Map<string, number> = new Map();

  for (const group of recentGroups) {
    const ids = group.players.map((p) => p.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('-');
        pairFrequency.set(key, (pairFrequency.get(key) || 0) + 1);
      }
    }
  }

  // Step 2: Sort players randomly to add variety
  const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);

  // Step 3: Try to form groups minimizing previous pairings
  const used = new Set<number>();

  while (used.size < shuffled.length) {
    const remaining = shuffled.filter((p) => !used.has(p.id));
    const groupSize = determineBestGroupSize(remaining.length, activePlayers.length);
    const group = pickBestGroup(remaining, groupSize, pairFrequency, recentGroups);

    for (const player of group) {
      used.add(player.id);
    }

    proposedGroups.push({ players: group });
  }

  return proposedGroups;
}

// Determines best group size based on how many players are left
function determineBestGroupSize(remaining: number, total: number): number {
  // Allow 2-player group only if total < 3 or exactly 5
  const allowTwoPlayer = total < 3 || total === 5;

  if (remaining >= 4) {
    // If forming a group of 4 doesn't leave a group of 2 or 1
    if (remaining - 4 >= 3 || remaining - 4 === 0) {
      return 4;
    }
    // If forming a group of 3 is better than leaving a 2
    if (remaining - 3 >= 3 || remaining - 3 === 0) {
      return 3;
    }
    // Only allow group of 2 if valid per above
    if (allowTwoPlayer && remaining === 2) {
      return 2;
    }
  } else if (remaining === 3) {
    return 3;
  } else if (remaining === 2) {
    return allowTwoPlayer ? 2 : 0;
  } else if (remaining === 1) {
    return allowTwoPlayer ? 1 : 0;
  }

  return 0; // fallback, should not be hit
}

// Utility: Get all combinations of a certain size
function getCombinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];

  function backtrack(start: number, path: T[]) {
    if (path.length === k) {
      results.push([...path]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }

  backtrack(0, []);
  return results;
}

// Utility: Check if two arrays are equal
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
