import * as SQLite from 'expo-sqlite';

export type Player = {
  id?: number;
  name: string;
  speedIndex: number;
  available?: boolean;
};

export type PlayerWithActive = Player & { id: number; active: boolean };

export type Round = {
  id: number;
  date: string; // ISO
  status: 'completed' | 'pending' | 'canceled';
};

const DB_NAME = 'cart-partners.db';

let db: any = null;

async function openDb() {
  if (!db) {
      db = await (SQLite as any).openDatabaseAsync(DB_NAME);
  }
  return db;
}

export async function initDb(): Promise<void> {
  const db = await openDb();
  await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, speedIndex REAL NOT NULL, available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS round_players (round_id INTEGER NOT NULL, player_id INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (round_id, player_id));
CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_players (group_id INTEGER NOT NULL, player_id INTEGER NOT NULL, cart_index INTEGER NOT NULL, slot_index INTEGER NOT NULL, PRIMARY KEY (group_id, cart_index, slot_index));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);
  // Try to add the column for older DBs; ignore errors if it already exists
  try {
    if (typeof db.execAsync === 'function') {
      await db.execAsync(`ALTER TABLE players ADD COLUMN available INTEGER NOT NULL DEFAULT 1;`);
    } else if (typeof db.runAsync === 'function') {
      await db.runAsync(`ALTER TABLE players ADD COLUMN available INTEGER NOT NULL DEFAULT 1;`);
    }
  } catch (e) {
    // column probably exists - ignore
  }
}

export async function addPlayer(player: Player): Promise<number | undefined> {
  const database = await openDb();
    const avail = player.available === undefined ? 1 : (player.available ? 1 : 0);
    const res = await database.runAsync(`INSERT INTO players (name, speedIndex, available) VALUES (?, ?, ?);`, player.name, player.speedIndex, avail);
    return res?.insertId ?? undefined;
}

export async function createRound(status: Round['status'] = 'pending'): Promise<number | undefined> {
  const database = await openDb();
  const date = new Date().toISOString();
  if (typeof database.runAsync === 'function') {
    const res = await database.runAsync(`INSERT INTO rounds (date, status) VALUES (?, ?);`, date, status);
    return res?.insertId ?? undefined;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`INSERT INTO rounds (date, status) VALUES ('${date}', '${status}');`);
    try {
      const rows = typeof database.getAllAsync === 'function' ? await database.getAllAsync(`SELECT last_insert_rowid() as id;`) : [];
      return rows && rows[0] && rows[0].id ? Number(rows[0].id) : undefined;
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
}

export async function getRounds(): Promise<Round[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT id, date, status FROM rounds ORDER BY id DESC;`);
    return rows || [];
  }
  return [];
}

export type RoundSummary = Round & { activeCount: number };

export async function getRoundSummaries(): Promise<RoundSummary[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT r.id, r.date, r.status, COUNT(CASE WHEN rp.active = 1 THEN 1 END) as activeCount FROM rounds r LEFT JOIN round_players rp ON r.id = rp.round_id GROUP BY r.id ORDER BY r.id DESC;`);
    return (rows || []).map((r: any) => ({ id: r.id, date: r.date, status: r.status, activeCount: Number(r.activeCount || 0) }));
  }
  return [];
}

export async function copyActivePlayersToRound(sourceRoundId: number, targetRoundId: number): Promise<void> {
  const database = await openDb();
  const sql = `INSERT OR REPLACE INTO round_players (round_id, player_id, active) SELECT ${targetRoundId}, rp.player_id, rp.active FROM round_players rp WHERE rp.round_id = ${sourceRoundId} AND rp.active = 1;`;
  if (typeof database.execAsync === 'function') await database.execAsync(sql);
  else if (typeof database.runAsync === 'function') await database.runAsync(sql);
}

// --- Groups helpers ---
export async function createGroupForRound(roundId: number): Promise<number | undefined> {
  const database = await openDb();
  const date = new Date().toISOString();
  if (typeof database.runAsync === 'function') {
    const res = await database.runAsync(`INSERT INTO groups (round_id, created_at) VALUES (?, ?);`, roundId, date);
    return res?.insertId ?? undefined;
  }
  if (typeof database.withTransactionAsync === 'function') {
    let insertId: number | undefined = undefined;
    await database.withTransactionAsync(async (txn: any) => {
      const r = await txn.execAsync(`INSERT INTO groups (round_id, created_at) VALUES (?, ?);`, [roundId, date]);
      if (r && (r as any).insertId) insertId = (r as any).insertId;
    });
    if (insertId) return insertId;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`INSERT INTO groups (round_id, created_at) VALUES (${roundId}, '${date}');`);
    try {
      const rows = typeof database.getAllAsync === 'function' ? await database.getAllAsync(`SELECT last_insert_rowid() as id;`) : [];
      return rows && rows[0] && rows[0].id ? Number(rows[0].id) : undefined;
    } catch (e) {
      return undefined;
    }
  }
  throw new Error('No suitable async DB API available to create group');
}

export async function addPlayersToGroup(groupId: number, players: { player_id: number; cart_index: number; slot_index: number }[]): Promise<void> {
  const database = await openDb();
  if (typeof database.withTransactionAsync === 'function') {
    await database.withTransactionAsync(async (txn: any) => {
      for (const p of players) {
        await txn.execAsync(`INSERT OR REPLACE INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, [groupId, p.player_id, p.cart_index, p.slot_index]);
      }
    });
    return;
  }
  if (typeof database.runAsync === 'function') {
    for (const p of players) {
      await database.runAsync(`INSERT OR REPLACE INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, groupId, p.player_id, p.cart_index, p.slot_index);
    }
    return;
  }
  if (typeof database.execAsync === 'function') {
    const vals = players.map((p) => `(${groupId}, ${p.player_id}, ${p.cart_index}, ${p.slot_index})`).join(',');
    await database.execAsync(`INSERT OR REPLACE INTO group_players (group_id, player_id, cart_index, slot_index) VALUES ${vals};`);
    return;
  }
  throw new Error('No suitable async DB API available to add players to group');
}

export type Group = { id: number; round_id: number; created_at: string; players: { player_id: number; cart_index: number; slot_index: number; name?: string; speedIndex?: number }[] };

export async function getGroupsForRound(roundId: number): Promise<Group[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT id, round_id, created_at FROM groups WHERE round_id = ? ORDER BY id DESC;`, [roundId]);
    const groups: Group[] = (rows || []).map((r: any) => ({ id: r.id, round_id: r.round_id, created_at: r.created_at, players: [] }));
    if (!groups.length) return [];
    const ids = groups.map((g) => g.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows2 = typeof database.getAllAsync === 'function' ? await database.getAllAsync(`SELECT gp.group_id, gp.player_id, gp.cart_index, gp.slot_index, p.name, p.speedIndex FROM group_players gp JOIN players p ON p.id = gp.player_id WHERE gp.group_id IN (${placeholders}) ORDER BY gp.group_id, gp.cart_index, gp.slot_index;`, ids) : [];
    for (const row of (rows2 || [])) {
      const g = groups.find((gg) => gg.id === row.group_id);
      if (g) g.players.push({ player_id: row.player_id, cart_index: row.cart_index, slot_index: row.slot_index, name: row.name, speedIndex: typeof row.speedIndex === 'number' ? row.speedIndex : Number(row.speedIndex) });
    }
    return groups;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`SELECT id, round_id, created_at FROM groups WHERE round_id = ${roundId} ORDER BY id DESC;`);
    return [];
  }
  throw new Error('No suitable async DB API available to get groups');
}

export async function deleteGroupById(groupId: number): Promise<void> {
  const database = await openDb();
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`DELETE FROM group_players WHERE group_id = ${groupId};`);
    await database.execAsync(`DELETE FROM groups WHERE id = ${groupId};`);
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`DELETE FROM group_players WHERE group_id = ?;`, groupId);
    await database.runAsync(`DELETE FROM groups WHERE id = ?;`, groupId);
    return;
  }
  throw new Error('No suitable async DB API available to delete group');
}

export async function deleteGroupsForRound(roundId: number): Promise<void> {
  const database = await openDb();
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ${roundId});`);
    await database.execAsync(`DELETE FROM groups WHERE round_id = ${roundId};`);
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ?);`, roundId);
    await database.runAsync(`DELETE FROM groups WHERE round_id = ?;`, roundId);
    return;
  }
  throw new Error('No suitable async DB API available to delete groups for round');
}

export async function updateGroupPlayers(groupId: number, players: { player_id: number; cart_index: number; slot_index: number }[]): Promise<void> {
  const database = await openDb();
  if (typeof database.withTransactionAsync === 'function') {
    await database.withTransactionAsync(async (txn: any) => {
      await txn.execAsync(`DELETE FROM group_players WHERE group_id = ?;`, [groupId]);
      for (const p of players) {
        await txn.execAsync(`INSERT INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, [groupId, p.player_id, p.cart_index, p.slot_index]);
      }
    });
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`DELETE FROM group_players WHERE group_id = ?;`, groupId);
    for (const p of players) {
      await database.runAsync(`INSERT INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, groupId, p.player_id, p.cart_index, p.slot_index);
    }
    return;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`DELETE FROM group_players WHERE group_id = ${groupId};`);
    const vals = players.map((p) => `(${groupId}, ${p.player_id}, ${p.cart_index}, ${p.slot_index})`).join(',');
    if (vals.length) await database.execAsync(`INSERT INTO group_players (group_id, player_id, cart_index, slot_index) VALUES ${vals};`);
    return;
  }
  throw new Error('No suitable async DB API available to update group players');
}

export async function getRecentActivePlayerIds(roundId: number, lookbackRounds = 3): Promise<{ activeIds: number[]; recentIds: number[] }> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT player_id FROM round_players WHERE round_id = ? AND active = 1;`, [roundId]);
    const activeIds = (rows || []).map((r: any) => r.player_id);
    const rounds = await database.getAllAsync(`SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`, [roundId, lookbackRounds]);
    if (!rounds || !rounds.length) return { activeIds, recentIds: [] };
    const rids = rounds.map((r: any) => r.id);
    const placeholders = rids.map(() => '?').join(',');
    const rows3 = await database.getAllAsync(`SELECT DISTINCT player_id FROM round_players WHERE round_id IN (${placeholders}) AND active = 1;`, rids);
    const recentIds = (rows3 || []).map((r: any) => r.player_id);
    return { activeIds, recentIds };
  }
  return { activeIds: [], recentIds: [] };
}

export async function getRecentPairCounts(roundId: number, lookbackRounds = 3): Promise<Record<string, number>> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rounds = await database.getAllAsync(`SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`, [roundId, lookbackRounds]);
    if (!rounds || !rounds.length) return {};
    const rids = rounds.map((r: any) => r.id);
    const placeholders = rids.map(() => '?').join(',');
    const gids = await database.getAllAsync(`SELECT id FROM groups WHERE round_id IN (${placeholders});`, rids);
    if (!gids || !gids.length) return {};
    const groupIds = gids.map((g: any) => g.id);
    const placeholders2 = groupIds.map(() => '?').join(',');
    const rows3 = await database.getAllAsync(
      `SELECT gp1.player_id as a, gp2.player_id as b FROM group_players gp1 JOIN group_players gp2 ON gp1.group_id = gp2.group_id AND gp1.player_id < gp2.player_id WHERE gp1.group_id IN (${placeholders2});`,
      groupIds
    );
    const counts: Record<string, number> = {};
    for (const row of (rows3 || [])) {
      const key = `${row.a}:${row.b}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
  return {};
}

export async function setRoundStatus(id: number, status: Round['status']): Promise<void> {
  const database = await openDb();
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`UPDATE rounds SET status = '${status}' WHERE id = ${id};`);
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`UPDATE rounds SET status = ? WHERE id = ?;`, status, id);
    return;
  }
  throw new Error('No suitable async DB API available to set round status');
}

export async function setActiveRound(id: number | null): Promise<void> {
  const database = await openDb();
  if (id == null) {
    if (typeof database.execAsync === 'function') { await database.execAsync(`DELETE FROM meta WHERE key = 'active_round';`); return; }
    if (typeof database.runAsync === 'function') { await database.runAsync(`DELETE FROM meta WHERE key = ?;`, 'active_round'); return; }
  } else {
    if (typeof database.execAsync === 'function') { await database.execAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('active_round', '${String(id)}');`); return; }
    if (typeof database.runAsync === 'function') { await database.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);`, 'active_round', String(id)); return; }
  }
  throw new Error('No suitable async DB API available to set active round');
}

export async function getActiveRound(): Promise<number | null> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT value FROM meta WHERE key = ? LIMIT 1;`, ['active_round']);
    if (rows && rows.length) return rows[0].value ? Number(rows[0].value) : null;
    return null;
  }
  return null;
}

export async function setPlayerActiveForRound(roundId: number, playerId: number, active: boolean): Promise<void> {
  const database = await openDb();
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`INSERT OR REPLACE INTO round_players (round_id, player_id, active) VALUES (?, ?, ?);`, roundId, playerId, active ? 1 : 0);
    return;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`INSERT OR REPLACE INTO round_players (round_id, player_id, active) VALUES (${roundId}, ${playerId}, ${active ? 1 : 0});`);
    return;
  }
  throw new Error('No suitable async DB API available to set player active flag');
}

export async function getPlayersForRound(roundId: number | null): Promise<PlayerWithActive[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    if (roundId == null) {
      const rows = await database.getAllAsync(`SELECT id, name, speedIndex, IFNULL(available, 1) as available FROM players WHERE available = 1;`);
      return (rows || []).map((r: any) => ({ id: r.id, name: r.name, speedIndex: Number(r.speedIndex), active: false, } as any)).map((p: any, i: number) => ({ ...p, available: !!rows[i].available }));
    }
    const rows = await database.getAllAsync(`SELECT p.id, p.name, p.speedIndex, IFNULL(rp.active, 0) as active, IFNULL(p.available, 1) as available FROM players p LEFT JOIN round_players rp ON p.id = rp.player_id AND rp.round_id = ?;`, [roundId]);
    return (rows || []).map((r: any) => ({ id: r.id, name: r.name, speedIndex: Number(r.speedIndex), active: !!r.active } as any)).map((p: any, i: number) => ({ ...p, available: !!rows[i].available }));
  }
  return [];
}

export async function getPlayers(onlyAvailable?: boolean): Promise<Player[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const sql = !onlyAvailable ? `SELECT id, name, speedIndex, IFNULL(available, 1) as available FROM players ORDER BY name;` :
    `SELECT id, name, speedIndex, IFNULL(available, 1) as available FROM players WHERE available = 1 ORDER BY name;`;
    const rows = await database.getAllAsync(sql);
    return (rows || []).map((r: any) => ({ id: r.id, name: r.name, speedIndex: typeof r.speedIndex === 'number' ? r.speedIndex : Number(r.speedIndex), available: r.available === 1 }));
  }
  return [];
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT id, name, speedIndex, IFNULL(available, 1) as available FROM players WHERE id = ? LIMIT 1;`, [id]);
    if (!rows || !rows.length) return null;
    const r = rows[0];
    return { id: r.id, name: r.name, speedIndex: typeof r.speedIndex === 'number' ? r.speedIndex : Number(r.speedIndex), available: r.available === 1 };
  }
  return null;
}

export async function updatePlayerById(
  id: number,
  fields: { name?: string; speedIndex?: number; available?: boolean }
): Promise<void> {
  const database = await openDb();

  const sets: string[] = [];
  const params: any[] = [];

  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.speedIndex !== undefined) {
    sets.push('speedIndex = ?');
    params.push(fields.speedIndex);
  }
  if (fields.available !== undefined) {
    sets.push('available = ?');
    params.push(fields.available ? 1 : 0);
  }

  if (sets.length === 0) return; // Nothing to update

  // Add id to parameters for the WHERE clause
  const sql = `UPDATE players SET ${sets.join(', ')} WHERE id = ?;`;
  params.push(id);

  // Prefer using parameterized statements
  if (typeof database.runAsync === 'function') {
    await database.runAsync(sql, params);
    return;
  }

  // If execAsync is supported and it takes raw SQL (less safe), use it carefully
  if (typeof database.execAsync === 'function') {
    // You could consider escaping values or validating more strictly here
    throw new Error('execAsync not supported for parameterized queries. Use runAsync instead.');
  }

  throw new Error('No supported database method found.');
}

export async function deletePlayerById(id: number): Promise<void> {
  const database = await openDb();
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`DELETE FROM round_players WHERE player_id = ${id};`);
    await database.execAsync(`DELETE FROM players WHERE id = ${id};`);
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`DELETE FROM round_players WHERE player_id = ?;`, id);
    await database.runAsync(`DELETE FROM players WHERE id = ?;`, id);
    return;
  }
  return;
}

// (name-based helper removed — use explicit ids)
