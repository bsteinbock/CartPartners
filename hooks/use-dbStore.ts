// use-DbStore.ts
import { File, Paths } from 'expo-file-system';
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

export function getDatabasePath(): string {
  const db = getDb();
  return db.databasePath;
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

/**
 * Restore the database from a given file URI.
 * Automatically backs up current DB before restoring.
 * Uses modern expo-file-system API.
 * @param selectedFileUri The URI of the backup database to restore
 */
export const restoreDatabaseFromFile = async (selectedFileUri: string): Promise<boolean> => {
  try {
    // Construct file / directory references
    const currentDbFile = new File(getDatabasePath());
    const sourceFile = new File(selectedFileUri);

    const now = new Date();
    const timestamp = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
    const fileName = `cartpartners-backup-${timestamp}.db`;

    const backupFile = new File(Paths.cache, fileName);
    if (backupFile.exists) {
      backupFile.delete();
    }

    //  Backup current DB
    currentDbFile.copy(backupFile);

    // Copy selected DB into app’s cache to safely open and inspect
    const tempImportFile = new File(Paths.cache, 'imported-temp.db');
    if (tempImportFile.exists) {
      tempImportFile.delete();
    }
    sourceFile.copy(tempImportFile);
    const testDb = SQLite.openDatabaseSync('imported-temp.db', undefined, Paths.cache.uri);

    // explicitly type the query result as an array of objects with a `name` string property
    const tables = testDb
      .getAllSync<{ name: string }>('SELECT name FROM sqlite_master WHERE type="table";')
      .map((row) => row.name);

    const expectedTables = ['players', 'rounds', 'round_players', 'groups', 'group_players'];

    await testDb.closeAsync();
    for (const table of expectedTables) {
      if (!tables.includes(table)) {
        throw new Error(`Invalid database: missing table ${table}`);
      }
    }

    // Replace current DB with selectedFile
    if (db) {
      await db.closeAsync();
      db = null;
    }

    currentDbFile.delete();
    sourceFile.copy(currentDbFile);

    initDb(); // re-initialize DB connection and schema if needed

    return true;
  } catch (error) {
    console.error('restoreDatabaseFromFile error:', error);
    return false;
  }
};

// ------------------- TYPES -------------------
export type Player = { id: number; name: string; speedIndex: number; email: string; available: number };
export type Round = { id: number; date: string; course: string };
export type Group = { id: number; round_id: number; slot_index: number; created_at: string };
export type RoundPlayer = { round_id: number; player_id: number };
export type RoundSummary = { round_id: number; numPlayers: number };
export type GroupPlayers = { group_id: number; player_ids: number[] };
export type ManualGroupList = number[];

type DbState = {
  players: Player[];
  rounds: Round[]; // most recent at index 0
  groups: Group[];
  roundPlayers: RoundPlayer[];
  roundSummaries: RoundSummary[];
  groupPlayers: GroupPlayers[];
  manualGroupList: ManualGroupList[]; // only for current round, clear in currentRoundIdChanges

  currentRoundId: number | null;

  fetchPlayers: () => void;
  fetchRounds: () => void;
  fetchGroups: () => void;
  fetchRoundPlayers: () => void;
  fetchGroupPlayers: () => void;

  setRoundPlayers: (roundId: number, playerIds: number[]) => void;

  addPlayer: (name: string, email: string, speedIndex: number) => void;
  addPlayers: (players: { name: string; speedIndex: number; email: string; available: number }[]) => void;
  updatePlayer: (id: number, data: Partial<Omit<Player, 'id'>>) => void;
  deletePlayer: (id: number) => void;

  addGroup: (roundId: number, slotIndex: number) => void;
  addRound: (date: string, course: string) => void;
  deleteRound: (id: number) => void;
  updateRound: (id: number, data: Partial<Omit<Round, 'id'>>) => void;

  refreshAll: () => void;
  setGroupsForRound: (roundId: number, groupsList: number[][]) => void;
  swapGroupSlots: (groupId1: number, slotIndex1: number, groupId2: number, slotIndex2: number) => void;

  setCurrentRoundId: (id: number | null) => void;
  setManualGroupList: (groupList: ManualGroupList[]) => void;
};

// ------------------- STORE -------------------
export const useDbStore = create<DbState>((set, get) => ({
  players: [],
  rounds: [],
  groups: [],
  roundPlayers: [],
  roundSummaries: [],
  groupPlayers: [],
  manualGroupList: [],
  currentRoundId: null,

  setCurrentRoundId: (id: number | null) => {
    set({ currentRoundId: id });
    set({ manualGroupList: [] });
  },

  // --- Fetchers ------------------------------------------------------------
  fetchPlayers: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM players ORDER BY name ASC;') as Player[];
    set({ players: rows });
  },
  fetchRounds: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM rounds ORDER BY date DESC;') as Round[];
    set({
      rounds: rows,
      // Set currentRoundId to most recent round if not already set
      currentRoundId: get().currentRoundId ?? (rows.length > 0 ? rows[0].id : null),
    });
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
  fetchGroupPlayers: () => {
    const db = getDb();

    // Get all groups first
    const groups = db.getAllSync('SELECT id FROM groups ORDER BY slot_index;') as { id: number }[];

    // For each group, get its players
    const groupPlayers: GroupPlayers[] = [];

    for (const group of groups) {
      const players = db.getAllSync(
        'SELECT player_id FROM group_players WHERE group_id = ? ORDER BY player_id;',
        [group.id],
      ) as { player_id: number }[];

      groupPlayers.push({
        group_id: group.id,
        player_ids: players.map((p) => p.player_id),
      });
    }

    set({ groupPlayers });
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
  addPlayers: (players: { name: string; speedIndex: number; email: string; available: number }[]) => {
    const db = getDb();
    db.withTransactionSync(() => {
      for (const { name, speedIndex, email, available } of players) {
        db.runSync('INSERT INTO players (name, speedIndex, email, available) VALUES (?, ?, ?, ?)', [
          name,
          speedIndex,
          email,
          available ? 1 : 0,
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
    useDbStore.getState().setManualGroupList([]);
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
        db.runSync('INSERT INTO round_players (round_id, player_id) VALUES (?, ?);', [roundId, playerId]);
      }
    });

    useDbStore.getState().fetchRoundPlayers();
    useDbStore.getState().setManualGroupList([]);
  },

  // --- Refresh All ---------------------------------------------------------
  refreshAll: () => {
    const {
      fetchPlayers,
      fetchRounds,
      fetchGroups,
      fetchRoundPlayers,
      fetchGroupPlayers,
      setManualGroupList,
    } = useDbStore.getState();

    fetchPlayers();
    fetchRounds();
    fetchGroups();
    fetchRoundPlayers();
    fetchGroupPlayers();
    setManualGroupList([]);
  },

  // --- Set Group and Group Members Mutations ----------------------------------------------------
  setGroupsForRound: (roundId: number, groupsList: number[][]) => {
    const db = getDb();
    const createdAt = new Date().toISOString();

    db.withTransactionSync(() => {
      // 1. Clear existing groups for this round
      const oldGroups = db.getAllSync('SELECT id FROM groups WHERE round_id = ?;', [roundId]) as {
        id: number;
      }[];
      for (const g of oldGroups) {
        db.runSync('DELETE FROM group_players WHERE group_id = ?;', [g.id]);
      }
      db.runSync('DELETE FROM groups WHERE round_id = ?;', [roundId]);

      // 2. Create new groups
      for (let i = 0; i < groupsList.length; i++) {
        // Insert group
        db.runSync('INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);', [
          roundId,
          i,
          createdAt,
        ]);

        // Get the new group's ID
        const [{ id: groupId }] = db.getAllSync('SELECT id FROM groups ORDER BY id DESC LIMIT 1;') as {
          id: number;
        }[];

        // Insert players for this group
        for (const playerId of groupsList[i]) {
          db.runSync('INSERT INTO group_players (group_id, player_id) VALUES (?, ?);', [groupId, playerId]);
        }
      }
    });

    // Refresh groups in store
    const { fetchGroups, fetchGroupPlayers } = useDbStore.getState();
    fetchGroups();
    fetchGroupPlayers();
  },

  swapGroupSlots: (groupId1: number, slotIndex1: number, groupId2: number, slotIndex2: number) => {
    const db = getDb();

    db.withTransactionSync(() => {
      db.runSync('UPDATE groups SET slot_index = ? WHERE id = ?;', [slotIndex2, groupId1]);
      db.runSync('UPDATE groups SET slot_index = ? WHERE id = ?;', [slotIndex1, groupId2]);
    });

    // Refresh store data
    const { fetchGroups, fetchGroupPlayers } = useDbStore.getState();
    fetchGroups();
    fetchGroupPlayers();
  },

  setManualGroupList: (groupList: ManualGroupList[]) => {
    set({ manualGroupList: groupList });
  },

  deleteRound: (id: number) => {
    const db = getDb();
    db.runSync('DELETE FROM rounds WHERE id = ?;', [id]);

    db.runSync('DELETE FROM round_players WHERE round_id = ?;', [id]);

    const groupIds = db
      .getAllSync<{ id: number }>('SELECT id FROM groups WHERE round_id = ?;', [id])
      .map((row) => row.id);

    for (const groupId of groupIds) {
      db.runSync('DELETE FROM group_players WHERE group_id = ?;', [groupId]);
    }

    db.runSync('DELETE FROM groups WHERE round_id = ?;', [id]);
    if (get().currentRoundId === id) {
      if (get().rounds.length > 0) {
        const remainingRounds = get().rounds.filter((r) => r.id !== id);
        const mostRecentRoundId = remainingRounds.length > 0 ? remainingRounds[0].id : null;
        useDbStore.getState().setCurrentRoundId(mostRecentRoundId);
      } else {
        useDbStore.getState().setCurrentRoundId(null);
      }
    } else {
      useDbStore.getState().setCurrentRoundId(null);
    }
    useDbStore.getState().fetchRounds();
    useDbStore.getState().fetchGroups();
    useDbStore.getState().fetchRoundPlayers();
    useDbStore.getState().fetchGroupPlayers();
    useDbStore.getState().setManualGroupList([]);
  },
}));
