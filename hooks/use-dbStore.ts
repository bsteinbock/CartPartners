// use-DbStore.ts
import { formatPhoneNumberToE164 } from '@/lib/cart-utils';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { create } from 'zustand';

const DB_SUBDIR = 'db';
const DB_BACKUP_SUBDIR = 'db-backup';
const DB_NAME = 'cart-partners.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabasePath(): string {
  const db = getDb();
  return db.databasePath;
}

function getDb() {
  if (!db) {
    const directory = new Directory(Paths.document, DB_SUBDIR);
    if (!directory.exists) directory.create({ idempotent: true });

    db = SQLite.openDatabaseSync(DB_NAME, undefined, directory.uri);
  }
  return db;
}

// new helpers for meta storage
function readMeta(key: string): string | null {
  try {
    const database = getDb();
    // guard in case meta table doesn't exist yet
    const tableCheck = database.getFirstSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='meta' LIMIT 1;`,
    );
    if (!tableCheck) return null;

    const row = database.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1;', [
      key,
    ]);
    return row?.value ?? null;
  } catch (e) {
    // meta table missing or other DB error — return null and continue
    console.warn('readMeta failed, returning null', e);
    return null;
  }
}

function writeMeta(key: string, value: string | null): void {
  try {
    const database = getDb();
    // ensure meta table exists
    database.execSync(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    if (value === null) {
      database.runSync('DELETE FROM meta WHERE key = ?;', [key]);
      return;
    }
    const exists = database.getFirstSync<{ key: string }>('SELECT key FROM meta WHERE key = ? LIMIT 1;', [
      key,
    ]);
    if (exists) {
      database.runSync('UPDATE meta SET value = ? WHERE key = ?;', [value, key]);
    } else {
      database.runSync('INSERT INTO meta (key, value) VALUES (?, ?);', [key, value]);
    }
  } catch (e) {
    console.warn('writeMeta failed', e);
  }
}

// ------------------- INIT DB -------------------
export function initDb() {
  const db = getDb();
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      mobile_number TEXT DEFAULT '',
      speedIndex REAL NOT NULL,
      email TEXT,
      available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS league_players (
      league_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      PRIMARY KEY (league_id, player_id),
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      course TEXT NOT NULL,
      tee_time_info TEXT DEFAULT '',
      league_id INTEGER
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

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // --- Migration step for existing DBs ---
  const playerCols = db.getAllSync<{ name: string }>(`PRAGMA table_info(players);`).map((r) => r.name);

  if (!playerCols.includes('nickname')) {
    db.execSync(`ALTER TABLE players ADD COLUMN nickname TEXT DEFAULT '';`);
  }

  if (!playerCols.includes('mobile_number')) {
    db.execSync(`ALTER TABLE players ADD COLUMN mobile_number TEXT DEFAULT '';`);
  }

  const roundCols = db.getAllSync<{ name: string }>(`PRAGMA table_info(rounds);`).map((r) => r.name);
  if (!roundCols.includes('tee_time_info')) {
    db.execSync(`ALTER TABLE rounds ADD COLUMN tee_time_info TEXT DEFAULT '';`);
  }
  if (!roundCols.includes('league_id')) {
    db.execSync(`ALTER TABLE rounds ADD COLUMN league_id INTEGER;`);
  }

  // ensure leagues table exists for older DBs
  db.execSync(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  // Migrate league_id from players table to new league_players table
  const leaguePlayersTableExists = db.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='league_players' LIMIT 1;`,
  );

  if (leaguePlayersTableExists && playerCols.includes('league_id')) {
    // Migrate existing data from players.league_id to league_players table
    const playersWithLeague = db.getAllSync<{ id: number; league_id: number | null }>(
      'SELECT id, league_id FROM players WHERE league_id IS NOT NULL;',
    );

    db.withTransactionSync(() => {
      for (const player of playersWithLeague) {
        db.runSync('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?);', [
          player.league_id,
          player.id,
        ]);
      }
    });

    // Drop the league_id column from players if it exists
    try {
      db.execSync(`ALTER TABLE players DROP COLUMN league_id;`);
    } catch (e) {
      console.warn('Could not drop league_id column from players (may not exist):', e);
    }
  }

  // Ensure a "Default" league exists and assign existing players/rounds to it if they have no league_id
  // Only insert a "Default" league and update existing players/rounds if the leagues table is empty
  const leagueCountRow = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM leagues;');
  const leagueCount = leagueCountRow?.count ?? 0;
  if (leagueCount === 0) {
    db.runSync('INSERT INTO leagues (name) VALUES (?);', ['Default']);
    const row = db.getFirstSync<{ id: number }>('SELECT id FROM leagues WHERE name = ? LIMIT 1;', [
      'Default',
    ]);
    const defaultLeagueId = row?.id ?? null;
    if (defaultLeagueId != null) {
      // Insert all players into the default league if they're not already assigned
      const allPlayers = db.getAllSync<{ id: number }>('SELECT id FROM players;');
      db.withTransactionSync(() => {
        for (const player of allPlayers) {
          db.runSync('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?);', [
            defaultLeagueId,
            player.id,
          ]);
        }
      });
      db.runSync('UPDATE rounds SET league_id = ? WHERE league_id IS NULL;', [defaultLeagueId]);
    }
  }
}

// --- BACKUP WITH CLOSE AND REOPEN ---
export async function backupDatabase() {
  const backupDir = new Directory(Paths.cache, DB_BACKUP_SUBDIR);

  // 1. Clean previous backup and create a clean backup directory
  if (backupDir.exists) {
    backupDir.delete();
  }
  backupDir.create({ idempotent: true, intermediates: true });

  // 2. Close the DB before copying (IMPORTANT for iOS)
  const database = getDb();
  const dbPath = database.databasePath;
  try {
    database.closeSync();
  } catch (err) {
    console.warn('Failed to close DB (may already be closed):', err);
  }

  // 3. Copy the db to the back-up location
  const backupFile = new File(backupDir, DB_NAME);
  const sourceDbFile = new File(dbPath);
  if (sourceDbFile.exists) {
    sourceDbFile.copy(backupFile);
  } else {
    console.error('Source DB does not exist!');
    throw new Error('Source DB does not exist!');
  }

  // 4. Reopen the DB so the app can keep using it
  try {
    db = SQLite.openDatabaseSync(DB_NAME, undefined, new Directory(Paths.document, DB_SUBDIR).uri);
  } catch (err) {
    console.error('Failed to reopen DB after backup!', err);
    throw err;
  }

  // 5. Optionally share the DB
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(`${backupFile.uri}`);
  }
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
    const currentDbFile = new File(Paths.document, DB_SUBDIR, DB_NAME);
    const sourceFile = new File(selectedFileUri);

    const now = new Date();
    const timestamp = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
    const fileName = `cp-backup-${timestamp}.db`;

    const backupFile = new File(Paths.document, DB_SUBDIR, fileName);
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

    testDb.closeSync();
    for (const table of expectedTables) {
      if (!tables.includes(table)) {
        throw new Error(`Invalid database: missing table ${table}`);
      }
    }

    // Replace current DB with selectedFile
    if (db) {
      db.closeSync();
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
export type Player = {
  id: number;
  name: string;
  nickname: string;
  mobile_number: string;
  speedIndex: number;
  email: string;
  available: number;
  league_id?: number | null;
};
export type Round = {
  id: number;
  date: string;
  course: string;
  teeTimeInfo: string;
  league_id?: number | null;
};
export type League = { id: number; name: string };
export type Group = { id: number; round_id: number; slot_index: number; created_at: string };
export type RoundPlayer = { round_id: number; player_id: number };
export type RoundSummary = { round_id: number; numPlayers: number };
export type GroupPlayers = { group_id: number; player_ids: number[] };
export type ManualGroupList = number[];
export type NewPlayer = Pick<Player, 'name'> & Partial<Omit<Player, 'id' | 'name'>>;
export type UpdatedPlayer = Partial<Omit<Player, 'id'>>;
export type UpdatedRound = Partial<Omit<Round, 'id'>>;

type DbState = {
  league_players: Player[];
  all_players: Player[];
  rounds: Round[]; // most recent at index 0
  groups: Group[];
  roundPlayers: RoundPlayer[];
  roundSummaries: RoundSummary[];
  groupPlayers: GroupPlayers[];
  leagues: League[];
  manualGroupList: ManualGroupList[]; // only for current round, clear in currentRoundIdChanges

  currentRoundId: number | null;
  currentLeagueId: number | null;

  fetchLeaguePlayers: (leagueId?: number | null) => void;
  fetchAllPlayers: () => void;
  fetchRounds: () => void;
  fetchLeagues: () => void;
  fetchGroups: () => void;
  fetchRoundPlayers: () => void;
  fetchGroupPlayers: () => void;

  setRoundPlayers: (roundId: number, playerIds: number[]) => void;

  addPlayer: (player: NewPlayer, leagueId?: number | null) => void;
  addPlayers: (players: NewPlayer[], leagueId?: number | null, refresh?: boolean) => void;
  addPlayerToLeague: (playerId: number, leagueId: number, refresh?: boolean) => void;
  addPlayersToLeague: (playerIds: number[], leagueId: number, refresh?: boolean) => void;
  removePlayerFromLeague: (playerId: number, leagueId: number, refresh?: boolean) => void;
  addLeague: (name: string) => void;
  updatePlayer: (id: number, data: UpdatedPlayer, refresh?: boolean) => void;
  deletePlayer: (id: number) => void;

  addGroup: (roundId: number, slotIndex: number) => void;
  addRound: (date: string, course: string, teeTimeInfo: string, leagueId?: number | null) => void;
  deleteRound: (id: number) => void;
  updateRound: (id: number, data: UpdatedRound) => void;

  refreshAll: () => void;
  setGroupsForRound: (roundId: number, groupsList: number[][]) => void;
  updateGroupPlayers: (groupId: number, playerIds: number[]) => void;
  swapGroupSlots: (groupId1: number, slotIndex1: number, groupId2: number, slotIndex2: number) => void;

  setCurrentRoundId: (id: number | null) => void;
  setCurrentLeagueId: (id: number | null) => void;
  updateLeague: (id: number, name: string) => void;
  deleteLeague: (id: number) => void;
  setManualGroupList: (groupList: ManualGroupList[]) => void;
};

// ------------------- STORE -------------------
export const useDbStore = create<DbState>((set, get) => ({
  league_players: [],
  all_players: [],
  rounds: [],
  leagues: [],
  groups: [],
  roundPlayers: [],
  roundSummaries: [],
  groupPlayers: [],
  manualGroupList: [],
  // initialize currentLeagueId from meta if available (will be null until fetchLeagues runs too)
  currentRoundId: null,
  currentLeagueId: readMeta('lastActiveLeagueId') ? Number(readMeta('lastActiveLeagueId')) : null,

  setCurrentRoundId: (id: number | null) => {
    set({ currentRoundId: id });
    set({ manualGroupList: [] });
  },

  setCurrentLeagueId: (id: number | null) => {
    // persist to DB meta
    try {
      if (id === null) {
        writeMeta('lastActiveLeagueId', null);
      } else {
        writeMeta('lastActiveLeagueId', String(id));
      }
    } catch (e) {
      console.warn('Failed to persist lastActiveLeagueId', e);
    }
    set({ currentLeagueId: id });
    set({ manualGroupList: [] });
    useDbStore.getState().refreshAll();
  },

  // --- League functions ---------------------------------------------------
  fetchLeagues: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT id, name FROM leagues ORDER BY name ASC;') as League[];
    set({ leagues: rows });

    // if no currentLeagueId set in memory, try to initialize from meta or first league
    const current = get().currentLeagueId;
    if (current == null) {
      const lastActive = readMeta('lastActiveLeagueId');
      if (lastActive) {
        const parsed = Number(lastActive);
        if (!isNaN(parsed) && rows.some((r) => r.id === parsed)) {
          set({ currentLeagueId: parsed });
        } else if (rows.length > 0) {
          set({ currentLeagueId: rows[0].id });
          writeMeta('lastActiveLeagueId', String(rows[0].id));
        }
      } else if (rows.length > 0) {
        set({ currentLeagueId: rows[0].id });
        writeMeta('lastActiveLeagueId', String(rows[0].id));
      }
    }
  },

  addLeague: (name: string) => {
    const db = getDb();
    db.runSync('INSERT INTO leagues (name) VALUES (?);', [name]);
    // refresh leagues list
    useDbStore.getState().refreshAll();
  },

  updateLeague: (id: number, name: string) => {
    const db = getDb();
    db.runSync('UPDATE leagues SET name = ? WHERE id = ?;', [name, id]);
    // refresh leagues list
    useDbStore.getState().refreshAll();
  },

  deleteLeague: (id: number) => {
    const db = getDb();
    db.withTransactionSync(() => {
      // Delete league_players associations
      db.runSync('DELETE FROM league_players WHERE league_id = ?;', [id]);
      // unset league_id on related rounds
      db.runSync('UPDATE rounds SET league_id = NULL WHERE league_id = ?;', [id]);
      // delete the league
      db.runSync('DELETE FROM leagues WHERE id = ?;', [id]);
    });
    // refresh related state
    const { refreshAll } = useDbStore.getState();

    // if deleted league was active, get the first league to set as current if any exist
    const current = get().currentLeagueId;
    if (current === id) {
      const leagues = db.getAllSync<League>('SELECT id, name FROM leagues ORDER BY name ASC;');
      if (leagues.length > 0) {
        const firstLeagueId = leagues[0].id;
        set({ currentLeagueId: firstLeagueId });
        writeMeta('lastActiveLeagueId', String(firstLeagueId));
      } else {
        set({ currentLeagueId: null });
        writeMeta('lastActiveLeagueId', null);
      }
    }
    refreshAll();
  },

  // --- Fetchers ------------------------------------------------------------
  fetchLeaguePlayers: (leagueId?: number | null) => {
    const db = getDb();
    const currentLeagueId = leagueId ?? get().currentLeagueId;

    if (!currentLeagueId) {
      set({ league_players: [] });
      return;
    }

    const rows = db.getAllSync<Player>(
      `SELECT p.id, p.name, p.nickname, p.mobile_number, p.speedIndex, p.email, p.available
       FROM players p
       INNER JOIN league_players lp ON p.id = lp.player_id
       WHERE lp.league_id = ?
       ORDER BY p.name ASC;`,
      [currentLeagueId],
    );

    set({ league_players: rows });
  },

  fetchAllPlayers: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM players ORDER BY name ASC;') as Player[];
    set({ all_players: rows });
  },

  fetchRounds: () => {
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM rounds WHERE league_id = ? ORDER BY date DESC;', [
      get().currentLeagueId ?? 0,
    ]) as {
      id: number;
      date: string;
      course: string;
      tee_time_info: string;
      league_id?: number | null;
    }[];

    const rounds: Round[] = rows.map((r) => ({
      id: r.id,
      date: r.date,
      course: r.course,
      teeTimeInfo: r.tee_time_info ?? '',
      league_id: (r as any).league_id ?? null,
    }));

    set({
      rounds,
      currentRoundId: get().currentRoundId ?? (rounds.length > 0 ? rounds[0].id : null),
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
  addPlayer: (player: NewPlayer, leagueId: number | null | undefined) => {
    const db = getDb();

    const { name, speedIndex = 1, nickname = '', mobile_number = '', email = '', available = 1 } = player;
    const e164 = formatPhoneNumberToE164(mobile_number);
    const storedNumber = e164 || '';

    db.runSync(
      'INSERT INTO players (name, nickname, mobile_number, speedIndex, email, available) VALUES (?, ?, ?, ?, ?, ?)',
      [name, nickname, storedNumber, speedIndex, email, available ? 1 : 0],
    );

    if (leagueId) {
      // Get the newly inserted player's ID
      const newPlayer = db.getFirstSync<{ id: number }>('SELECT id FROM players ORDER BY id DESC LIMIT 1;');
      if (newPlayer) {
        db.runSync('INSERT INTO league_players (league_id, player_id) VALUES (?, ?);', [
          leagueId,
          newPlayer.id,
        ]);
      }
    }

    const { fetchLeaguePlayers, fetchGroups, fetchRoundPlayers, fetchAllPlayers } = useDbStore.getState();
    fetchLeaguePlayers(leagueId);
    fetchAllPlayers();
    fetchGroups();
    fetchRoundPlayers();
  },

  deletePlayer: (id: number) => {
    const db = getDb();
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM players WHERE id = ?', [id]);
      db.runSync('DELETE FROM round_players WHERE player_id = ?', [id]);
      db.runSync('DELETE FROM group_players WHERE player_id = ?', [id]);
      db.runSync('DELETE FROM league_players WHERE player_id = ?', [id]);
    });
    const {
      fetchLeaguePlayers,
      fetchAllPlayers,
      fetchGroups,
      fetchRoundPlayers,
      fetchGroupPlayers,
      setManualGroupList,
    } = useDbStore.getState();
    fetchLeaguePlayers();
    fetchAllPlayers();
    fetchGroups();
    fetchRoundPlayers();
    setManualGroupList([]);
    fetchGroupPlayers();
  },

  // Update an existing player
  updatePlayer: (id: number, data: UpdatedPlayer, refresh = true) => {
    const db = getDb();

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.nickname !== undefined) {
      updates.push('nickname = ?');
      params.push(data.nickname);
    }
    if (data.mobile_number !== undefined) {
      updates.push('mobile_number = ?');
      const e164 = formatPhoneNumberToE164(data.mobile_number);
      const storedNumber = e164 || '';
      params.push(storedNumber);
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

    if (updates.length === 0) return; // nothing to update

    params.push(id);
    const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?;`;
    db.runSync(sql, params);

    if (refresh) {
      const { fetchLeaguePlayers, fetchAllPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
      fetchLeaguePlayers(null);
      fetchAllPlayers();
      fetchGroups();
      fetchRoundPlayers();
    }
  },

  // Add multiple players at once
  addPlayers: (players: NewPlayer[], leagueId?: number | null, refresh = true) => {
    const db = getDb();
    db.withTransactionSync(() => {
      for (const {
        name,
        speedIndex = 1,
        nickname = '',
        mobile_number = '',
        email = '',
        available = 1,
      } of players) {
        const e164 = formatPhoneNumberToE164(mobile_number);
        const storedNumber = e164 || '';

        db.runSync(
          'INSERT INTO players (name, nickname, mobile_number, speedIndex, email, available) VALUES (?, ?, ?, ?, ?, ?)',
          [name, nickname, storedNumber, speedIndex, email, available ? 1 : 0],
        );

        if (leagueId) {
          // Get the newly inserted player's ID
          const newPlayer = db.getFirstSync<{ id: number }>(
            'SELECT id FROM players ORDER BY id DESC LIMIT 1;',
          );
          if (newPlayer) {
            db.runSync('INSERT INTO league_players (league_id, player_id) VALUES (?, ?);', [
              leagueId,
              newPlayer.id,
            ]);
          }
        }
      }
    });

    if (refresh) {
      const { fetchLeaguePlayers, fetchAllPlayers, fetchGroups, fetchRoundPlayers } = useDbStore.getState();
      fetchAllPlayers();
      fetchLeaguePlayers();
      fetchGroups();
      fetchRoundPlayers();
    }
  },

  addPlayerToLeague: (playerId: number, leagueId: number, refresh = true) => {
    const db = getDb();
    try {
      db.runSync('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?);', [
        leagueId,
        playerId,
      ]);
      if (refresh) useDbStore.getState().fetchLeaguePlayers();
    } catch (e) {
      console.error('Failed to add player to league:', e);
    }
  },

  addPlayersToLeague: (playerIds: number[], leagueId: number, refresh = true) => {
    const db = getDb();

    try {
      db.withTransactionSync(() => {
        // Insert new player list
        for (const playerId of playerIds) {
          db.runSync('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?);', [
            leagueId,
            playerId,
          ]);
        }
      });

      if (refresh) {
        useDbStore.getState().fetchLeaguePlayers();
        useDbStore.getState().fetchRoundPlayers();
        useDbStore.getState().setManualGroupList([]);
      }
    } catch (e) {
      console.error('Failed to add players to league:', e);
    }
  },

  removePlayerFromLeague: (playerId: number, leagueId: number, refresh = true) => {
    const db = getDb();
    try {
      db.runSync('DELETE FROM league_players WHERE league_id = ? AND player_id = ?;', [leagueId, playerId]);
      if (refresh) useDbStore.getState().fetchLeaguePlayers();
    } catch (e) {
      console.error('Failed to remove player from league:', e);
    }
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

  addRound: (course, date, teeTimeInfo, leagueId?: number | null) => {
    const db = getDb();
    db.runSync('INSERT INTO rounds (date, course, tee_time_info, league_id) VALUES (?, ?, ?, ?)', [
      date,
      course,
      teeTimeInfo,
      leagueId ?? null,
    ]);
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

    if (data.teeTimeInfo) {
      updates.push('tee_time_info = ?');
      params.push(data.teeTimeInfo);
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
      fetchLeaguePlayers,
      fetchAllPlayers,
      fetchRounds,
      fetchGroups,
      fetchRoundPlayers,
      fetchGroupPlayers,
      setManualGroupList,
      fetchLeagues,
    } = useDbStore.getState();

    fetchLeaguePlayers();
    fetchAllPlayers();
    fetchRounds();
    fetchGroups();
    fetchRoundPlayers();
    fetchGroupPlayers();
    fetchLeagues();
    setManualGroupList([]);
  },

  updateGroupPlayers: (groupId: number, playerIds: number[]) => {
    const db = getDb();

    db.withTransactionSync(() => {
      // Remove existing players from the group
      db.runSync('DELETE FROM group_players WHERE group_id = ?;', [groupId]);

      // Add new players to the group
      for (const playerId of playerIds) {
        db.runSync('INSERT INTO group_players (group_id, player_id) VALUES (?, ?);', [groupId, playerId]);
      }

      // Since we may have manually updated the players in the groups for this round, go through and reset the active players
      // for this round to match those used in the groups.
      const roundInfo = db.getFirstSync<{ round_id: number }>('SELECT round_id FROM groups WHERE id = ?;', [
        groupId,
      ]);

      const roundId = roundInfo?.round_id;
      if (roundId) {
        const otherGroups = useDbStore
          .getState()
          .groups.filter((g) => g.round_id === roundInfo?.round_id && g.id !== groupId);
        const otherGroupPlayerIds = otherGroups.flatMap((g) => {
          const gp = useDbStore.getState().groupPlayers.find((pg) => pg.group_id === g.id);
          return gp ? gp.player_ids : [];
        });

        // add all the ids from playerIds
        const revisedPlayerIds = new Set<number>();
        for (const playerId of playerIds) {
          revisedPlayerIds.add(playerId);
        }
        for (const playerId of otherGroupPlayerIds) {
          revisedPlayerIds.add(playerId);
        }

        // Remove all previous assignments
        db.runSync('DELETE FROM round_players WHERE round_id = ?;', [roundId]);

        // Insert new player list
        for (const playerId of revisedPlayerIds) {
          db.runSync('INSERT INTO round_players (round_id, player_id) VALUES (?, ?);', [roundId, playerId]);
        }
      }
    });

    // Refresh store data
    const { fetchGroups, fetchGroupPlayers, fetchRoundPlayers } = useDbStore.getState();
    fetchGroups();
    fetchRoundPlayers();
    fetchGroupPlayers();
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

// Ensure DB schema exists and load leagues at module load so "Default" is created when necessary
initDb();
useDbStore.getState().fetchLeagues();
