/**
 * group-distribution.test.ts
 *
 * Simulates 60 rounds of group generation to verify that the algorithm
 * correctly distributes part-time players among full-time players and
 * avoids excessive repeat pairings.
 *
 * Player roster matches the names from the reported frequency matrix.
 * Full-timers play every round; part-timers play ~40% of rounds (2-4 per round).
 */

import {
  buildPlayingPartnerFrequencies,
  generateGroupsForRound,
  localSwapImprove,
  scoreGroupArrangement,
} from '../lib/cart-utils';

// ---------------------------------------------------------------------------
// Player definitions
// ---------------------------------------------------------------------------

type SimPlayer = { id: number; name: string };

const FULL_TIMERS: SimPlayer[] = [
  { id: 1, name: 'Andy D' },
  { id: 3, name: 'Bernie B' },
  { id: 4, name: 'Bill S' },
  { id: 6, name: 'Carl C' },
  { id: 7, name: 'Clark C' },
  { id: 11, name: 'Ed M' },
  { id: 12, name: 'Garry M' },
  { id: 13, name: 'Greg W' },
  { id: 14, name: 'Huff' },
  { id: 15, name: 'Jack G' },
  { id: 16, name: 'Jack L' },
  { id: 17, name: 'Jerry C' },
  { id: 18, name: 'Joe G' },
  { id: 19, name: 'Joe H' },
  { id: 20, name: 'John B' },
  { id: 21, name: 'John R' },
  { id: 22, name: 'Kevin R' },
  { id: 23, name: 'Kevin T' },
  { id: 24, name: 'Kirk D' },
  { id: 25, name: 'Larry K' },
  { id: 26, name: 'Larry L' },
  { id: 27, name: 'Leo H' },
  { id: 28, name: 'Mark C' },
  { id: 29, name: 'Mark R' },
  { id: 30, name: 'Mike C' },
  { id: 31, name: 'Mike G' },
  { id: 32, name: 'Mike M' },
  { id: 33, name: 'Ralph S' },
  { id: 34, name: 'Richard R' },
  { id: 35, name: 'Robert R' },
  { id: 36, name: 'Ron W' },
  { id: 37, name: 'Val H' },
];

// Part-timers: players who appear in the matrix with near-zero history —
// they attend ~40% of rounds (24 of 60) and never more than 4 per round.
const PART_TIMERS: SimPlayer[] = [
  { id: 2, name: 'Ben F' },
  { id: 5, name: 'Brad N' },
  { id: 8, name: 'Dave C' },
  { id: 9, name: 'Dave F' },
  { id: 10, name: 'David H' },
];

const ALL_PLAYERS = [...FULL_TIMERS, ...PART_TIMERS];
const FULL_TIMER_IDS = new Set(FULL_TIMERS.map((p) => p.id));
const PART_TIMER_IDS = new Set(PART_TIMERS.map((p) => p.id));
const playerName = (id: number) => ALL_PLAYERS.find((p) => p.id === id)?.name ?? String(id);

// ---------------------------------------------------------------------------
// Deterministic seeded pseudo-random (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

type RoundPlayer = { round_id: number; player_id: number };
type GroupPlayers = { group_id: number; player_ids: number[] };

/**
 * Build the attendance schedule: for each of the 5 part-timers, decide which
 * rounds they attend so that each plays exactly 24 of the 60 rounds (40%).
 * 2-4 part-timers play per round (enforced by shuffling and capping).
 */
function buildPartTimerSchedule(rng: () => number, totalRounds: number): Map<number, Set<number>> {
  // Map: partTimerId -> Set of round indices they attend
  const schedule = new Map<number, Set<number>>(PART_TIMERS.map((p) => [p.id, new Set()]));

  // Target: each part-timer plays ~40% of rounds.
  // Distribute attendance: for each round pick 2-4 part-timers randomly.
  const targetRoundsPerPlayer = Math.round(totalRounds * 0.4);

  // Assign rounds greedily: shuffle part-timers each round, add the first 2–4
  // who still have remaining quota.
  for (let r = 0; r < totalRounds; r++) {
    const available = PART_TIMERS.filter((p) => (schedule.get(p.id)?.size ?? 0) < targetRoundsPerPlayer);
    if (available.length === 0) continue;
    // Shuffle available
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    const count = Math.min(available.length, 2 + Math.floor(rng() * 3)); // 2, 3, or 4
    for (let k = 0; k < count; k++) {
      schedule.get(available[k].id)!.add(r);
    }
  }

  return schedule;
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------

function runSimulation(totalRounds = 60) {
  const rng = mulberry32(0xdeadbeef);

  const schedule = buildPartTimerSchedule(rng, totalRounds);

  const groupHistory: GroupPlayers[] = [];
  const roundPlayerHistory: RoundPlayer[] = [];
  let groupIdCounter = 1;

  // Track per-part-timer: rounds played, how many of those had 0 other part-timers in group
  const partTimerStats = new Map<number, { roundsPlayed: number; roundsWithNoOtherPartTimer: number }>(
    PART_TIMERS.map((p) => [p.id, { roundsPlayed: 0, roundsWithNoOtherPartTimer: 0 }]),
  );

  for (let r = 0; r < totalRounds; r++) {
    // Determine lineup
    const presentPartTimers = PART_TIMERS.filter((p) => schedule.get(p.id)!.has(r));
    const playerIds = [...FULL_TIMERS.map((p) => p.id), ...presentPartTimers.map((p) => p.id)];

    // Compute roundParticipation from history
    const roundParticipation: Record<number, number> = {};
    for (const id of playerIds) {
      roundParticipation[id] = roundPlayerHistory.filter((rp) => rp.player_id === id).length;
    }

    // Compute partner frequencies from full history
    const partnerFrequencies = buildPlayingPartnerFrequencies(playerIds, groupHistory);

    // Generate groups
    const groups = generateGroupsForRound({
      playerIds,
      partnerFrequencies,
      roundParticipation,
      shuffle: true,
    });

    // Record results
    for (const group of groups) {
      const gid = groupIdCounter++;
      groupHistory.push({ group_id: gid, player_ids: group });
    }
    for (const id of playerIds) {
      roundPlayerHistory.push({ round_id: r, player_id: id });
    }

    // Update part-timer stats for this round
    for (const pt of presentPartTimers) {
      const stats = partTimerStats.get(pt.id)!;
      stats.roundsPlayed++;
      // Find which group this part-timer is in
      const myGroup = groups.find((g) => g.includes(pt.id))!;
      const otherPartTimersInGroup = myGroup.filter((id) => PART_TIMER_IDS.has(id) && id !== pt.id);
      if (otherPartTimersInGroup.length === 0) {
        stats.roundsWithNoOtherPartTimer++;
      }
    }
  }

  return { groupHistory, roundPlayerHistory, partTimerStats };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Group distribution simulation (60 rounds)', () => {
  const { groupHistory, roundPlayerHistory, partTimerStats } = runSimulation(60);

  // Build a pairings frequency map across all players for assertion use
  const allIds = ALL_PLAYERS.map((p) => p.id);
  const allFrequencies = buildPlayingPartnerFrequencies(allIds, groupHistory);

  // Compute unique partner counts for full-timers
  function uniquePartnerCount(id: number): number {
    return Object.keys(allFrequencies[id] ?? {}).length;
  }

  // Compute max repeat pairing for a given pair
  function pairRepeatCount(a: number, b: number): number {
    return allFrequencies[a]?.[b] ?? 0;
  }

  // -------------------------------------------------------------------------
  // With the multi-trial + local-swap algorithm the expected max should be ~7
  // (expected mean ~5 with 60 rounds / 37 players, threshold = mean + 1.5 std-dev).
  it('Bill S and Ed M should not be paired more than 7 times (regression)', () => {
    const billId = 4;
    const edId = 11;
    const count = pairRepeatCount(billId, edId);
    expect(count).toBeLessThanOrEqual(7);
  });

  // -------------------------------------------------------------------------
  // Multi-trial + local-swap should keep the max well below the raw expected + 2σ.
  // Threshold 7 = expected mean (~5) + reasonable headroom.
  it('No full-timer pair should be grouped together more than 7 times', () => {
    const violations: string[] = [];
    for (const a of FULL_TIMERS) {
      for (const b of FULL_TIMERS) {
        if (b.id <= a.id) continue;
        const count = pairRepeatCount(a.id, b.id);
        if (count > 7) {
          violations.push(`${a.name} + ${b.name}: ${count} times`);
        }
      }
    }
    if (violations.length > 0) {
      console.log('Full-timer repeat violations:', violations);
    }
    expect(violations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  it('No part-timer should ever appear in an all-part-timer group', () => {
    const violations: string[] = [];
    for (const { group_id, player_ids } of groupHistory) {
      const partTimersInGroup = player_ids.filter((id) => PART_TIMER_IDS.has(id));
      if (partTimersInGroup.length >= 2 && player_ids.every((id) => PART_TIMER_IDS.has(id))) {
        violations.push(`group ${group_id}: ${player_ids.map(playerName).join(', ')}`);
      }
    }
    expect(violations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 60% means the majority of a part-timer's rounds are with all-full-timer groups.
  it('Each part-timer should be in a group with 0 other part-timers at least 60% of rounds they play', () => {
    for (const pt of PART_TIMERS) {
      const stats = partTimerStats.get(pt.id)!;
      if (stats.roundsPlayed === 0) continue;
      const ratio = stats.roundsWithNoOtherPartTimer / stats.roundsPlayed;
      expect(ratio).toBeGreaterThanOrEqual(
        0.6,
        // @ts-ignore — extra message arg accepted by jest
        `${pt.name}: only ${(ratio * 100).toFixed(0)}% of rounds had no other part-timer in group (${stats.roundsWithNoOtherPartTimer}/${stats.roundsPlayed})`,
      );
    }
  });

  // -------------------------------------------------------------------------
  it('Each part-timer should accumulate unique full-time partners >= 50% of full-timers', () => {
    const minFullTimePartners = Math.floor(FULL_TIMERS.length * 0.5); // 16 of 32
    for (const pt of PART_TIMERS) {
      const stats = partTimerStats.get(pt.id)!;
      if (stats.roundsPlayed === 0) continue;
      const uniqueFullTimePartners = Object.keys(allFrequencies[pt.id] ?? {})
        .map(Number)
        .filter((id) => FULL_TIMER_IDS.has(id)).length;
      expect(uniqueFullTimePartners).toBeGreaterThanOrEqual(
        minFullTimePartners,
        // @ts-ignore
        `${pt.name} only met ${uniqueFullTimePartners} unique full-timers in ${stats.roundsPlayed} rounds (min ${minFullTimePartners})`,
      );
    }
  });

  // -------------------------------------------------------------------------
  it('Each full-timer should have at least 25 unique partners after 60 rounds', () => {
    // 60 rounds with local-swap optimization should push coverage well above 22.
    const minUniquePartners = 25;
    const underperformers: string[] = [];
    for (const ft of FULL_TIMERS) {
      const count = uniquePartnerCount(ft.id);
      if (count < minUniquePartners) {
        underperformers.push(`${ft.name}: ${count} unique partners`);
      }
    }
    if (underperformers.length > 0) {
      console.log('Full-timer unique partner underperformers:', underperformers);
    }
    expect(underperformers).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  it('Part-timers should not cluster together: max part-timer pair repeat count <= 3', () => {
    const violations: string[] = [];
    for (const a of PART_TIMERS) {
      for (const b of PART_TIMERS) {
        if (b.id <= a.id) continue;
        const count = pairRepeatCount(a.id, b.id);
        if (count > 3) {
          violations.push(`${a.name} + ${b.name}: ${count} times`);
        }
      }
    }
    if (violations.length > 0) {
      console.log('Part-timer clustering violations:', violations);
    }
    expect(violations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  it('Prints a summary of part-timer distribution for manual review', () => {
    console.log('\n=== Part-timer distribution summary ===');
    for (const pt of PART_TIMERS) {
      const stats = partTimerStats.get(pt.id)!;
      if (stats.roundsPlayed === 0) continue;
      const ratio = (stats.roundsWithNoOtherPartTimer / stats.roundsPlayed) * 100;
      const uniqueFullTime = Object.keys(allFrequencies[pt.id] ?? {})
        .map(Number)
        .filter((id) => FULL_TIMER_IDS.has(id)).length;
      console.log(
        `  ${pt.name.padEnd(10)}: ${stats.roundsPlayed} rounds, ` +
          `${ratio.toFixed(0)}% solo-in-group, ` +
          `${uniqueFullTime} unique full-time partners`,
      );
    }
    console.log('\n=== Top repeat pairings among full-timers ===');
    const pairs: { a: string; b: string; count: number }[] = [];
    for (const a of FULL_TIMERS) {
      for (const b of FULL_TIMERS) {
        if (b.id <= a.id) continue;
        const count = pairRepeatCount(a.id, b.id);
        if (count >= 3) pairs.push({ a: a.name, b: b.name, count });
      }
    }
    pairs.sort((x, y) => y.count - x.count);
    for (const p of pairs.slice(0, 10)) {
      console.log(`  ${p.a} + ${p.b}: ${p.count}`);
    }
  });
});

// ===========================================================================
// 15-player lineup regression
// ===========================================================================

describe('15-player lineup regression (30 rounds)', () => {
  // The 15 players that triggered the bug report (Bill S, Ed M, Carl C,
  // Bernie B, Garry M + 10 other full-timers).
  const FIFTEEN_PLAYERS: SimPlayer[] = [
    { id: 3, name: 'Bernie B' },
    { id: 4, name: 'Bill S' },
    { id: 6, name: 'Carl C' },
    { id: 7, name: 'Clark C' },
    { id: 11, name: 'Ed M' },
    { id: 12, name: 'Garry M' },
    { id: 13, name: 'Greg W' },
    { id: 15, name: 'Jack G' },
    { id: 17, name: 'Jerry C' },
    { id: 18, name: 'Joe G' },
    { id: 20, name: 'John B' },
    { id: 22, name: 'Kevin R' },
    { id: 25, name: 'Larry K' },
    { id: 28, name: 'Mark C' },
    { id: 30, name: 'Mike C' },
  ];
  const FIFTEEN_IDS = FIFTEEN_PLAYERS.map((p) => p.id);

  type SmallGroupPlayers = { group_id: number; player_ids: number[] };

  function run15PlayerSim(totalRounds: number) {
    const groupHistory: SmallGroupPlayers[] = [];
    const roundPlayerHistory: { round_id: number; player_id: number }[] = [];
    let gidCounter = 1;

    for (let r = 0; r < totalRounds; r++) {
      const roundParticipation: Record<number, number> = {};
      for (const id of FIFTEEN_IDS) {
        roundParticipation[id] = roundPlayerHistory.filter((rp) => rp.player_id === id).length;
      }
      const partnerFrequencies = buildPlayingPartnerFrequencies(FIFTEEN_IDS, groupHistory);
      const groups = generateGroupsForRound({
        playerIds: FIFTEEN_IDS,
        partnerFrequencies,
        roundParticipation,
        shuffle: true,
      });
      for (const group of groups) {
        groupHistory.push({ group_id: gidCounter++, player_ids: group });
      }
      for (const id of FIFTEEN_IDS) {
        roundPlayerHistory.push({ round_id: r, player_id: id });
      }
    }
    return { groupHistory };
  }

  const { groupHistory } = run15PlayerSim(30);
  const freq15 = buildPlayingPartnerFrequencies(FIFTEEN_IDS, groupHistory);

  it('No pair in a 15-player lineup should be grouped together more than 7 times in 30 rounds', () => {
    // With 15 players in groups of ~4, expected pairings per pair ≈ 30 × 3 / 14 ≈ 6.4
    const violations: string[] = [];
    for (let i = 0; i < FIFTEEN_PLAYERS.length; i++) {
      for (let j = i + 1; j < FIFTEEN_PLAYERS.length; j++) {
        const a = FIFTEEN_PLAYERS[i];
        const b = FIFTEEN_PLAYERS[j];
        const count = freq15[a.id]?.[b.id] ?? 0;
        if (count > 7) violations.push(`${a.name} + ${b.name}: ${count}`);
      }
    }
    if (violations.length > 0) console.log('15-player pair violations:', violations);
    expect(violations).toHaveLength(0);
  });

  it('Bill S and Ed M should not be paired more than 7 times in a 15-player, 30-round sim', () => {
    const count = freq15[4]?.[11] ?? 0;
    expect(count).toBeLessThanOrEqual(7);
  });

  it('Carl C + Bernie B + Garry M should not ALL appear in the same group more than 3 times', () => {
    // They can only be together if they share a group; with 4 groups per round
    // this happens ~1–2 times by chance alone and should not exceed 3 with active
    // swap optimization separating high-repeat pairs.
    const tripleCount = groupHistory.filter(
      (g) => g.player_ids.includes(3) && g.player_ids.includes(6) && g.player_ids.includes(12),
    ).length;
    expect(tripleCount).toBeLessThanOrEqual(3);
  });
});

// ===========================================================================
// Unit tests for scoreGroupArrangement and localSwapImprove
// ===========================================================================

describe('localSwapImprove unit tests', () => {
  it('never increases the score', () => {
    // Groups where players 1 and 2 (freq=4 together) are in the same group
    const freqs: Record<number, Record<number, number>> = {
      1: { 2: 4 },
      2: { 1: 4 },
      3: {},
      4: {},
      5: {},
      6: {},
    };
    const groups = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const before = scoreGroupArrangement(groups, freqs);
    const improved = localSwapImprove(groups, freqs);
    const after = scoreGroupArrangement(improved, freqs);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('separates a high-repeat pair into different groups', () => {
    const freqs: Record<number, Record<number, number>> = {
      1: { 2: 5 },
      2: { 1: 5 },
      3: {},
      4: {},
      5: {},
      6: {},
    };
    // Start: 1+2 together (high cost)
    const groups = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const improved = localSwapImprove(groups, freqs);
    // 1 and 2 must be in different groups after improvement
    const g0HasBoth = improved[0].includes(1) && improved[0].includes(2);
    const g1HasBoth = improved[1].includes(1) && improved[1].includes(2);
    expect(g0HasBoth || g1HasBoth).toBe(false);
  });

  it('does not change groups when no improvement is possible', () => {
    // All players have zero repeat history — score is 0, nothing to improve
    const freqs: Record<number, Record<number, number>> = {
      1: {},
      2: {},
      3: {},
      4: {},
      5: {},
      6: {},
    };
    const groups = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const before = scoreGroupArrangement(groups, freqs);
    const improved = localSwapImprove(groups, freqs);
    const after = scoreGroupArrangement(improved, freqs);
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  it('scoreGroupArrangement returns 0 for a fresh roster', () => {
    const freqs: Record<number, Record<number, number>> = {
      10: {},
      20: {},
      30: {},
      40: {},
    };
    expect(
      scoreGroupArrangement(
        [
          [10, 20],
          [30, 40],
        ],
        freqs,
      ),
    ).toBe(0);
  });

  it('scoreGroupArrangement uses squared penalty', () => {
    // Pair (1,2) played together 3 times: cost = 3² = 9
    const freqs: Record<number, Record<number, number>> = { 1: { 2: 3 }, 2: { 1: 3 }, 3: {}, 4: {} };
    expect(
      scoreGroupArrangement(
        [
          [1, 2],
          [3, 4],
        ],
        freqs,
      ),
    ).toBe(9);
  });
});
