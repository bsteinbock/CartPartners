// use-DbStore.ts
import * as SQLite from 'expo-sqlite';
import { create } from 'zustand';

const DB_NAME = 'cart-partners.db';

let db: SQLite.SQLiteDatabase | null = null;

function getDb() {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

// ------------------- INIT DB -------------------
export function initDb() {
  const db = getDb();
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      speedIndex REAL NOT NULL,
      email TEXT,
      available INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      course TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS round_players (
      round_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (round_id, player_id)
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_players (
      group_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, player_id)
    );
  `);
}

// ------------------- TYPES -------------------
export type Player = { id: number; name: string; speedIndex: number; email: string; available: number };
export type Round = { id: number; date: string; course: string };
export type Group = { id: number; round_id: number; slot_index: number; created_at: string };
export type RoundPlayer = { round_id: number; player_id: number; active: number };
export type RoundSummary = { round_id: number; numPlayers: number };

type DbState = {
  players: Player[];
  rounds: Round[];
  groups: Group[];
  roundPlayers: RoundPlayer[];
  roundSummaries: RoundSummary[];

  fetchPlayers: () => void;
  fetchRounds: () => void;
  fetchGroups: () => void;

  fetchRoundPlayers: () => void;
  setRoundPlayers: (roundId: number, playerIds: number[]) => void;

  addPlayer: (name: string, email: string, speedIndex: number) => void;
  addPlayers: (players: { name: string; speedIndex: number; email: string }[]) => void;
  updatePlayer: (id: number, data: Partial<Omit<Player, 'id'>>) => void;
  deletePlayer: (id: number) => void;

  addGroup: (roundId: number, slotIndex: number) => void;
  addRound: (date: string, course: string) => void;

  updateRound: (id: number, data: Partial<Omit<Round, 'id'>>) => void;

  refreshAll: () => void;
  generateGroupsForRound: (roundId: number) => void;
};

// ------------------- STORE -------------------
export const useDbStore = create<DbState>((set) => ({
  players: [],
  rounds: [],
  groups: [],
  roundPlayers: [],
  roundSummaries: [],

  // --- Fetchers ------------------------------------------------------------
  fetchPlayers: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM players ORDER BY name ASC;') as Player[];
    set({ players: rows });
  },
  fetchRounds: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM rounds ORDER BY date DESC;') as Round[];
    set({ rounds: rows });
  },
  fetchGroups: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM groups ORDER BY id ASC;') as Group[];
    set({ groups: rows });
  },
  fetchRoundPlayers: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM round_players;') as RoundPlayer[];
    set({ roundPlayers: rows });

    // Update round summaries
    const summaries = rows.reduce((acc: Record<number, number>, rp) => {
      acc[rp.round_id] = (acc[rp.round_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const roundSummaries = Object.entries(summaries).map(([round_id, numPlayers]) => ({
      round_id: Number(round_id),
      numPlayers,
    }));

    set({ roundSummaries });
  },

  // --- Simple Mutations ----------------------------------------------------
  addPlayer: (name, email, speedIndex) => {
    const db = getDb();
    db.runSync('INSERT INTO players (name, email, speedIndex, available) VALUES (?, ?, ?, ?)', [
      name,
      email,
      speedIndex,
      1,
    ]);
    const { fetchPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
    fetchPlayers();
    fetchGroups();
    fetchRoundPlayers();
  },

  deletePlayer: (id: number) => {
    const db = getDb();
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM players WHERE id = ?', [id]);
      db.runSync('DELETE FROM round_players WHERE player_id = ?', [id]);
      db.runSync('DELETE FROM group_players WHERE player_id = ?', [id]);
    });
    const { fetchPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
    fetchPlayers();
    fetchGroups();
    fetchRoundPlayers();
  },

  // Update an existing player
  updatePlayer: (id: number, data: Partial<Omit<Player, 'id'>>) => {
    const db = getDb();

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.speedIndex !== undefined) {
      updates.push('speedIndex = ?');
      params.push(data.speedIndex);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (data.available !== undefined) {
      updates.push('available = ?');
      params.push(data.available);
    }

    if (updates.length === 0) return;

    params.push(id);
    const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?;`;
    db.runSync(sql, params);

    const { fetchPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
    fetchPlayers();
    fetchGroups();
    fetchRoundPlayers();
  },

  // Add multiple players at once
  addPlayers: (players: { name: string; speedIndex: number; email: string }[]) => {
    const db = getDb();
    db.withTransactionSync(() => {
      for (const { name, speedIndex, email } of players) {
        db.runSync('INSERT INTO players (name, speedIndex, email, available) VALUES (?, ?, ?, ?)', [
          name,
          speedIndex,
          email,
          1,
        ]);
      }
    });
    const { fetchPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
    fetchPlayers();
    fetchGroups();
    fetchRoundPlayers();
  },

  addGroup: (roundId, slotIndex) => {
    const db = getDb();
    const createdAt = new Date().toISOString();
    db.runSync('INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?)', [
      roundId,
      slotIndex,
      createdAt,
    ]);
    useDbStore.getState().fetchGroups();
  },

  addRound: (course, date) => {
    const db = getDb();
    db.runSync('INSERT INTO rounds (date, course) VALUES (?, ?)', [date, course]);
    useDbStore.getState().fetchRounds();
    useDbStore.getState().fetchRoundPlayers();
  },

  // Update a round (edit course/date)
  updateRound: (id, data) => {
    const db = getDb();

    // Only update provided fields
    const updates: string[] = [];
    const params: any[] = [];

    if (data.date) {
      updates.push('date = ?');
      params.push(data.date);
    }

    if (data.course) {
      updates.push('course = ?');
      params.push(data.course);
    }

    if (updates.length === 0) return; // nothing to update

    params.push(id);

    const sql = `UPDATE rounds SET ${updates.join(', ')} WHERE id = ?;`;
    db.runSync(sql, params);

    // Refresh rounds list
    const { fetchRounds } = useDbStore.getState();
    fetchRounds();
  },

  // Set all players for a round
  setRoundPlayers: (roundId, playerIds) => {
    const db = getDb();
    db.withTransactionSync(() => {
      // Remove all previous assignments
      db.runSync('DELETE FROM round_players WHERE round_id = ?;', [roundId]);

      // Insert new player list
      for (const playerId of playerIds) {
        db.runSync('INSERT INTO round_players (round_id, player_id, active) VALUES (?, ?, 1);', [
          roundId,
          playerId,
        ]);
      }
    });

    const { fetchRoundPlayers } = useDbStore.getState();
    fetchRoundPlayers();
  },

  // --- Refresh All ---------------------------------------------------------
  refreshAll: () => {
    const { fetchPlayers, fetchRounds, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
    fetchPlayers();
    fetchRounds();
    fetchGroups();
    fetchRoundPlayers();
  },

  // --- ✨ Generate Groups for Round ------------------------------------------------
  generateGroupsForRound: (roundId: number) => {
    const db = getDb();
    const recentRounds = db.getAllSync('SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT 4;', [
      roundId,
    ]) as { id: number }[];

    // 1️⃣ Get active players for this round
    const activePlayers = db.getAllSync(
      `
    SELECT p.id, p.name FROM players p
    JOIN round_players rp ON rp.player_id = p.id
    WHERE rp.round_id = ? AND rp.active = 1;
    `,
      [roundId],
    ) as { id: number; name: string }[];

    if (activePlayers.length < 3) {
      console.warn('Not enough active players to generate groups.');
      return;
    }

    // 2️⃣ Build pair history from previous 4 rounds
    const recentPairs = new Set<string>();
    for (const { id } of recentRounds) {
      const groupPlayers = db.getAllSync(
        'SELECT group_id, player_id FROM group_players gp JOIN groups g ON gp.group_id = g.id WHERE g.round_id = ?;',
        [id],
      ) as { group_id: number; player_id: number }[];

      const groupMap: Record<number, number[]> = {};
      groupPlayers.forEach((gp) => {
        groupMap[gp.group_id] = groupMap[gp.group_id] || [];
        groupMap[gp.group_id].push(gp.player_id);
      });

      for (const g of Object.values(groupMap)) {
        for (let i = 0; i < g.length; i++) {
          for (let j = i + 1; j < g.length; j++) {
            recentPairs.add([g[i], g[j]].sort().join('-'));
          }
        }
      }
    }

    // 3️⃣ Remove existing groups for this round
    db.withTransactionSync(() => {
      const oldGroups = db.getAllSync('SELECT id FROM groups WHERE round_id = ?;', [roundId]) as {
        id: number;
      }[];
      for (const g of oldGroups) {
        db.runSync('DELETE FROM group_players WHERE group_id = ?;', [g.id]);
      }
      db.runSync('DELETE FROM groups WHERE round_id = ?;', [roundId]);
    });

    // 4️⃣ Shuffle players randomly
    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);

    // 5️⃣ Create groups (4 max, 3 min)
    const groupSize = 4;
    const minGroup = 3;
    const groupsList: number[][] = [];

    while (shuffled.length > 0) {
      let group: number[] = [];
      group.push(shuffled.shift()!.id);

      while (group.length < groupSize && shuffled.length > 0) {
        const best = shuffled.reduce(
          (best, p) => {
            const conflicts = group.filter((g) => recentPairs.has([p.id, g].sort().join('-'))).length;
            return conflicts < best.conflicts ? { player: p, conflicts } : best;
          },
          { player: shuffled[0], conflicts: Infinity },
        );
        group.push(best.player.id);
        shuffled.splice(shuffled.indexOf(best.player), 1);
      }

      // If last group is too small, merge
      if (shuffled.length === 0 && group.length < minGroup && groupsList.length > 0) {
        groupsList[groupsList.length - 1].push(...group);
      } else {
        groupsList.push(group);
      }
    }

    // 6️⃣ Insert new groups
    db.withTransactionSync(() => {
      const createdAt = new Date().toISOString();
      for (let i = 0; i < groupsList.length; i++) {
        db.runSync('INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);', [
          roundId,
          i,
          createdAt,
        ]);
        const [{ id: groupId }] = db.getAllSync('SELECT id FROM groups ORDER BY id DESC LIMIT 1;') as {
          id: number;
        }[];
        for (const pid of groupsList[i]) {
          db.runSync('INSERT INTO group_players (group_id, player_id) VALUES (?, ?);', [groupId, pid]);
        }
      }
    });

    const { fetchGroups } = useDbStore.getState();
    fetchGroups();
  },
}));
