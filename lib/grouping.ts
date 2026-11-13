import type { Player } from '../hooks/use-dbStore';

export interface GroupParams {
  playerIds: number[];
  partnerFrequencies: Record<number, Record<number, number>>;
  allPlayers?: Player[];
  fairnessWeight?: number;
  shuffle?: boolean;
  avoidSlowPairs?: boolean;
  slowThreshold?: number;
  roundParticipation?: Record<number, number>;
  recentRoundGroups?: number[][][];
  recentRoundPenaltyWeights?: number[];
  previousRoundGroups?: number[][];
  previousRoundPenaltyWeight?: number;
}

type Score = [number, number, number, number, number, number];

const zeroScore = (): Score => [0, 0, 0, 0, 0, 0];

function compareScores(a: Score, b: Score): number {
  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i];
    if (Math.abs(difference) > 1e-9) return difference;
  }
  return 0;
}

function addScore(target: Score, score: Score, multiplier = 1): void {
  for (let i = 0; i < target.length; i++) target[i] += score[i] * multiplier;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
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
      if (groups.length > 0 && groups[groups.length - 1] === 4) {
        groups.pop();
        groups.push(3, 3);
        remaining -= 1;
      } else {
        groups.push(3);
        remaining -= 3;
      }
    } else if (remaining % 4 === 2) {
      if (remaining > 6) {
        groups.push(3);
        remaining -= 3;
      } else {
        groups.push(4, 4);
        remaining -= 8;
      }
    } else {
      groups.push(3);
      remaining -= 3;
    }
  }
  return groups;
}

function buildRecencyPenalties(rounds: number[][][], weights: number[]): Record<string, number> {
  const penalties: Record<string, number> = {};
  rounds.forEach((groups, index) => {
    const weight = weights[index] ?? 0;
    if (weight <= 0) return;
    const pairs = new Set<string>();
    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) pairs.add(pairKey(group[i], group[j]));
      }
    }
    for (const pair of pairs) penalties[pair] = (penalties[pair] ?? 0) + weight;
  });
  return penalties;
}

/**
 * Legacy repeat-and-recency score, retained for callers that inspect pair costs.
 * The generator also considers slow players, participation, and first-time pairs.
 */
export function scoreGroupArrangement(
  groups: number[][],
  partnerFrequencies: Record<number, Record<number, number>>,
  recencyPairPenalties: Record<string, number> = {},
): number {
  let score = 0;
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const frequency = partnerFrequencies[a]?.[b] ?? partnerFrequencies[b]?.[a] ?? 0;
        score += frequency * frequency + (recencyPairPenalties[pairKey(a, b)] ?? 0);
      }
    }
  }
  return score;
}

/**
 * Legacy repeat-and-recency swap optimizer.
 */
export function localSwapImprove(
  groups: number[][],
  partnerFrequencies: Record<number, Record<number, number>>,
  recencyPairPenalties: Record<string, number> = {},
): number[][] {
  const pairCosts = new Map<number, Map<number, Score>>();
  const players = groups.flat();
  for (const a of players) {
    const costs = new Map<number, Score>();
    for (const b of players) {
      const frequency = partnerFrequencies[a]?.[b] ?? partnerFrequencies[b]?.[a] ?? 0;
      costs.set(b, [0, 0, 0, frequency * frequency + (recencyPairPenalties[pairKey(a, b)] ?? 0), 0, 0]);
    }
    pairCosts.set(a, costs);
  }
  return improveSwaps(groups, pairCosts);
}

function improveSwaps(groups: number[][], costs: Map<number, Map<number, Score>>): number[][] {
  const result = groups.map((group) => [...group]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let gi = 0; gi < result.length - 1; gi++) {
      for (let gj = gi + 1; gj < result.length; gj++) {
        for (let pi = 0; pi < result[gi].length; pi++) {
          for (let pj = 0; pj < result[gj].length; pj++) {
            const a = result[gi][pi];
            const b = result[gj][pj];
            const delta = zeroScore();
            for (const member of result[gi]) {
              if (member === a) continue;
              addScore(delta, costs.get(b)!.get(member)!);
              addScore(delta, costs.get(a)!.get(member)!, -1);
            }
            for (const member of result[gj]) {
              if (member === b) continue;
              addScore(delta, costs.get(a)!.get(member)!);
              addScore(delta, costs.get(b)!.get(member)!, -1);
            }
            if (compareScores(delta, zeroScore()) < 0) {
              result[gi][pi] = b;
              result[gj][pj] = a;
              improved = true;
            }
          }
        }
      }
    }
  }
  return result;
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Groups players using lexicographic pair costs: slow pairs, infrequent pairs,
 * repeated pairs, recent pairs, repeat frequency, and individual fairness.
 */
export function generateGroupsForRound(params: Partial<GroupParams>): number[][] {
  const {
    playerIds = [],
    partnerFrequencies = {},
    allPlayers = [],
    fairnessWeight = 1,
    shuffle = true,
    avoidSlowPairs = true,
    slowThreshold = 4,
    roundParticipation,
    recentRoundGroups,
    recentRoundPenaltyWeights,
    previousRoundGroups,
    previousRoundPenaltyWeight = 50,
  } = params;
  if (!playerIds.length) throw new Error('generateGroupsForRound: playerIds array is required.');
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('generateGroupsForRound: playerIds must be unique.');
  }

  const rounds = recentRoundGroups?.length ? recentRoundGroups : previousRoundGroups ? [previousRoundGroups] : [];
  const weights = recentRoundPenaltyWeights?.length
    ? recentRoundPenaltyWeights
    : [previousRoundPenaltyWeight, Math.max(1, Math.round(previousRoundPenaltyWeight * 0.5))];
  const recency = buildRecencyPenalties(rounds, weights);
  const playerSpeeds = new Map(allPlayers.map((player) => [player.id, player.speedIndex]));
  const maxParticipation = roundParticipation ? Math.max(0, ...Object.values(roundParticipation)) : 0;
  const slow = new Set(playerIds.filter((id) => avoidSlowPairs && (playerSpeeds.get(id) ?? 0) > slowThreshold));
  const infrequent = new Set(
    playerIds.filter((id) => maxParticipation > 0 && (roundParticipation?.[id] ?? 0) * 2 < maxParticipation),
  );
  const fairness = new Map(
    playerIds.map((id) => {
      const uniquePartners = Object.keys(partnerFrequencies[id] ?? {}).length;
      const participation = Math.max(1, roundParticipation?.[id] ?? 1);
      return [id, 1 / (1 + uniquePartners / participation)];
    }),
  );
  const costs = new Map<number, Map<number, Score>>();
  for (const a of playerIds) costs.set(a, new Map());
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const a = playerIds[i];
      const b = playerIds[j];
      const frequency = partnerFrequencies[a]?.[b] ?? partnerFrequencies[b]?.[a] ?? 0;
      const score: Score = [
        Number(slow.has(a) && slow.has(b)),
        Number(infrequent.has(a) && infrequent.has(b)),
        Number(frequency > 0),
        recency[pairKey(a, b)] ?? 0,
        frequency * frequency,
        frequency === 0 ? -fairnessWeight * (fairness.get(a)! + fairness.get(b)!) : 0,
      ];
      costs.get(a)!.set(b, score);
      costs.get(b)!.set(a, score);
    }
  }

  const sizes = getGroupSizes(playerIds.length);
  let bestGroups: number[][] = [];
  let bestScore: Score | undefined;
  const trials = Math.min(8, playerIds.length);
  for (let trial = 0; trial < trials; trial++) {
    const order = [...playerIds];
    if (shuffle) shuffleInPlace(order);
    else order.push(...order.splice(0, trial));
    order.sort(
      (a, b) => Number(slow.has(b)) - Number(slow.has(a)) || Number(infrequent.has(b)) - Number(infrequent.has(a)),
    );
    const groups = sizes.map((): number[] => []);
    for (const player of order) {
      let bestGroup = -1;
      let bestIncrement: Score | undefined;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].length === sizes[i]) continue;
        const increment = zeroScore();
        for (const member of groups[i]) addScore(increment, costs.get(player)!.get(member)!);
        if (!bestIncrement || compareScores(increment, bestIncrement) < 0) {
          bestIncrement = increment;
          bestGroup = i;
        }
      }
      groups[bestGroup].push(player);
    }
    const improved = improveSwaps(groups, costs);
    const score = zeroScore();
    for (const group of improved) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) addScore(score, costs.get(group[i])!.get(group[j])!);
      }
    }
    if (!bestScore || compareScores(score, bestScore) < 0) {
      bestScore = score;
      bestGroups = improved;
    }
  }
  return bestGroups;
}
