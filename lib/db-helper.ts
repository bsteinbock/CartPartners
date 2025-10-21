import * as SQLite from 'expo-sqlite';
export type BasePlayer = {
  id: number;
  name: string;
  speedIndex: number;
  email?: string | null;
};

export type Player = BasePlayer & { available?: boolean };

export type PlayerWithActive = Player & { active: boolean };

export type Round = {
  id: number;
  date: string; // ISO
  course: string;
};

export type Group = {
  slot_index: number;
  players: BasePlayer[];
};

export type StoredGroup = Group & {
  id: number;
  round_id: number;
  created_at: string;
};

export type CartGroup = {
  players: BasePlayer[];
};

export function convertGroupsToCartGroups(groups: Group[]): CartGroup[] {
  return groups.map((group) => ({
    players: group.players,
  }));
}

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
CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, speedIndex REAL NOT NULL, email TEXT, available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, course TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS round_players (round_id INTEGER NOT NULL, player_id INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (round_id, player_id));
CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL, slot_index INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_players (group_id INTEGER NOT NULL, player_id INTEGER NOT NULL, PRIMARY KEY (group_id, player_id));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);
  // If DB already existed without the email column, attempt to add it (ignore errors)
  try {
    // Some SQLite builds support IF NOT EXISTS, but add column may fail if already present — swallow errors.
    await db.execAsync(`ALTER TABLE players ADD COLUMN email TEXT;`);
  } catch (e) {
    // ignore - column likely already exists
  }
}

export async function addPlayer(player: Omit<Player, 'id'>): Promise<number | undefined> {
  const database = await openDb();
  const avail = player.available === undefined ? 1 : player.available ? 1 : 0;
  const res = await database.runAsync(
    `INSERT INTO players (name, speedIndex, available, email) VALUES (?, ?, ?, ?);`,
    player.name,
    player.speedIndex,
    avail,
    player.email ?? null,
  );
  return res?.insertId ?? undefined;
}

export async function createRound(
  course: Round['course'] = 'TBD',
  date?: string,
): Promise<number | undefined> {
  const database = await openDb();
  const playDate = date ?? new Date().toISOString();
  const res = await database.runAsync(`INSERT INTO rounds (date, course) VALUES (?, ?);`, playDate, course);
  return res?.lastInsertRowId ?? undefined;
}

export async function getRoundById(id: number): Promise<Round | null> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT id, date, course FROM rounds WHERE id = ? LIMIT 1;`, [
      id,
    ]);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      date: r.date,
      course: r.course,
    };
  }
  return null;
}

export async function getRounds(): Promise<Round[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(`SELECT id, date, course FROM rounds ORDER BY id DESC;`);
    return rows || [];
  }
  return [];
}

export async function updateRoundById(
  id: number,
  fields: Partial<Pick<Round, 'date' | 'course'>>,
): Promise<void> {
  const database = await openDb();

  const sets: string[] = [];
  const params: any[] = [];

  if (fields.date !== undefined) {
    sets.push('date = ?');
    params.push(fields.date);
  }
  if (fields.course !== undefined) {
    sets.push('course = ?');
    params.push(fields.course);
  }

  if (sets.length === 0) return; // Nothing to update

  const sql = `UPDATE rounds SET ${sets.join(', ')} WHERE id = ?;`;
  params.push(id);

  if (typeof database.runAsync === 'function') {
    await database.runAsync(sql, params);
    return;
  }

  throw new Error('No supported database method found for updating round.');
}

export type RoundSummary = Round & { numActivePlayers: number };

export async function getRoundSummaries(): Promise<RoundSummary[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(
      `SELECT r.id, r.date, r.course, COUNT(CASE WHEN rp.active = 1 THEN 1 END) as activeCount FROM rounds r LEFT JOIN round_players rp ON r.id = rp.round_id GROUP BY r.id ORDER BY r.date DESC;`,
    );
    return (rows || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      course: r.course,
      numActivePlayers: Number(r.activeCount || 0),
    }));
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
export async function createGroupForRound(roundId: number, slot_index: number): Promise<number | undefined> {
  const database = await openDb();
  const date = new Date().toISOString();
  if (typeof database.runAsync === 'function') {
    const res = await database.runAsync(
      `INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);`,
      roundId,
      slot_index,
      date,
    );
    return res?.lastInsertRowId ?? undefined;
  }
  if (typeof database.withTransactionAsync === 'function') {
    let insertId: number | undefined = undefined;
    await database.withTransactionAsync(async (txn: any) => {
      const r = await txn.execAsync(
        `INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);`,
        [roundId, slot_index, date],
      );
      if (r && (r as any).insertId) insertId = (r as any).insertId;
    });
    if (insertId) return insertId;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(
      `INSERT INTO groups (round_id, slot_index, created_at) VALUES (${roundId}, ${slot_index}, '${date}');`,
    );
    try {
      const rows =
        typeof database.getAllAsync === 'function'
          ? await database.getAllAsync(`SELECT last_insert_rowid() as id;`)
          : [];
      return rows && rows[0] && rows[0].id ? Number(rows[0].id) : undefined;
    } catch (e) {
      return undefined;
    }
  }
  throw new Error('No suitable async DB API available to create group');
}

export async function addPlayersToGroup(groupId: number, players: { player_id: number }[]): Promise<void> {
  const database = await openDb();
  if (typeof database.withTransactionAsync === 'function') {
    await database.withTransactionAsync(async (txn: any) => {
      for (const p of players) {
        await txn.execAsync(`INSERT OR REPLACE INTO group_players (group_id, player_id) VALUES (?, ?);`, [
          groupId,
          p.player_id,
        ]);
      }
    });
    return;
  }
  if (typeof database.runAsync === 'function') {
    for (const p of players) {
      await database.runAsync(
        `INSERT OR REPLACE INTO group_players (group_id, player_id) VALUES (?, ?);`,
        groupId,
        p.player_id,
      );
    }
    return;
  }
  if (typeof database.execAsync === 'function') {
    const vals = players.map((p) => `(${groupId}, ${p.player_id})`).join(',');
    await database.execAsync(`INSERT OR REPLACE INTO group_players (group_id, player_id) VALUES ${vals};`);
    return;
  }
  throw new Error('No suitable async DB API available to add players to group');
}

export async function getGroupsForPreviousRound(roundId: number, maxRoundsToLookBack = 5): Promise<Group[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    // Get the date of the current round
    const curRows = await database.getAllAsync(`SELECT date FROM rounds WHERE id = ? LIMIT 1;`, [roundId]);
    if (!curRows || curRows.length === 0) return [];

    const currentDate = curRows[0].date;

    // Find up to maxRoundsToLookBack previous rounds by date (strictly before current round's date)
    const rounds = await database.getAllAsync(
      `SELECT id FROM rounds WHERE date < ? ORDER BY date DESC LIMIT ?;`,
      [currentDate, maxRoundsToLookBack],
    );
    if (!rounds || rounds.length === 0) return [];

    const rids = rounds.map((r: any) => r.id);
    const placeholders = rids.map(() => '?').join(',');

    // Get groups for those rounds, ordered by round date (most recent first) and slot_index
    const groupRows = await database.getAllAsync(
      `SELECT g.id, g.round_id, g.slot_index, g.created_at FROM groups g JOIN rounds r ON g.round_id = r.id WHERE g.round_id IN (${placeholders}) ORDER BY r.date DESC, g.slot_index;`,
      rids,
    );
    const groups: Group[] = (groupRows || []).map((r: any) => ({
      id: r.id,
      round_id: r.round_id,
      slot_index: r.slot_index,
      created_at: r.created_at,
      players: [],
    }));
    if (!groups.length) return [];

    const ids = groups.map((g) => g.id);
    const placeholders2 = ids.map(() => '?').join(',');

    const playerRows =
      typeof database.getAllAsync === 'function'
        ? await database.getAllAsync(
            `SELECT gp.group_id, gp.player_id, p.name, p.speedIndex, p.email FROM group_players gp JOIN players p ON p.id = gp.player_id WHERE gp.group_id IN (${placeholders2}) ORDER BY gp.group_id;`,
            ids,
          )
        : [];

    for (const row of playerRows || []) {
      const g = groups.find((gg) => gg.id === row.group_id);
      if (g)
        g.players.push({
          id: row.player_id,
          name: row.name,
          speedIndex: typeof row.speedIndex === 'number' ? row.speedIndex : Number(row.speedIndex),
          email: row.email ?? null,
        });
    }

    return groups;
  }

  // Fallback for execAsync-only DBs: attempt to exec and then try to fetch last results if getAllAsync exists.
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`SELECT date FROM rounds WHERE id = ${roundId} LIMIT 1;`);
    return [];
  }

  throw new Error('No suitable async DB API available to get previous round groups');
}

export async function getGroupsForRound(roundId: number): Promise<Group[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(
      `SELECT id, round_id, slot_index, created_at FROM groups WHERE round_id = ? ORDER BY slot_index;`,
      [roundId],
    );
    const groups: Group[] = (rows || []).map((r: any) => ({
      id: r.id,
      round_id: r.round_id,
      slot_index: r.slot_index,
      created_at: r.created_at,
      players: [],
    }));
    if (!groups.length) return [];
    const ids = groups.map((g) => g.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows2 =
      typeof database.getAllAsync === 'function'
        ? await database.getAllAsync(
            `SELECT gp.group_id, gp.player_id, p.name, p.speedIndex, p.email FROM group_players gp JOIN players p ON p.id = gp.player_id WHERE gp.group_id IN (${placeholders}) ORDER BY gp.group_id;`,
            ids,
          )
        : [];
    for (const row of rows2 || []) {
      const g = groups.find((gg) => gg.id === row.group_id);
      if (g)
        g.players.push({
          id: row.player_id,
          name: row.name,
          speedIndex: typeof row.speedIndex === 'number' ? row.speedIndex : Number(row.speedIndex),
          email: row.email ?? null,
        });
    }
    return groups;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(
      `SELECT id, round_id, slot_index, created_at FROM groups WHERE round_id = ${roundId} ORDER BY slot_index;`,
    );
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
    await database.execAsync(
      `DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ${roundId});`,
    );
    await database.execAsync(`DELETE FROM groups WHERE round_id = ${roundId};`);
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(
      `DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ?);`,
      roundId,
    );
    await database.runAsync(`DELETE FROM groups WHERE round_id = ?;`, roundId);
    return;
  }
  throw new Error('No suitable async DB API available to delete groups for round');
}

export async function updateGroupPlayers(groupId: number, players: { player_id: number }[]): Promise<void> {
  const database = await openDb();
  if (typeof database.withTransactionAsync === 'function') {
    await database.withTransactionAsync(async (txn: any) => {
      await txn.execAsync(`DELETE FROM group_players WHERE group_id = ?;`, [groupId]);
      for (const p of players) {
        await txn.execAsync(`INSERT INTO group_players (group_id, player_id) VALUES (?, ?);`, [
          groupId,
          p.player_id,
        ]);
      }
    });
    return;
  }
  if (typeof database.runAsync === 'function') {
    await database.runAsync(`DELETE FROM group_players WHERE group_id = ?;`, groupId);
    for (const p of players) {
      await database.runAsync(
        `INSERT INTO group_players (group_id, player_id) VALUES (?, ?);`,
        groupId,
        p.player_id,
      );
    }
    return;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(`DELETE FROM group_players WHERE group_id = ${groupId};`);
    const vals = players.map((p) => `(${groupId}, ${p.player_id})`).join(',');
    if (vals.length)
      await database.execAsync(`INSERT INTO group_players (group_id, player_id) VALUES ${vals};`);
    return;
  }
  throw new Error('No suitable async DB API available to update group players');
}

export async function getRecentActivePlayerIds(
  roundId: number,
  lookbackRounds = 3,
): Promise<{ activeIds: number[]; recentIds: number[] }> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(
      `SELECT player_id FROM round_players WHERE round_id = ? AND active = 1;`,
      [roundId],
    );
    const activeIds = (rows || []).map((r: any) => r.player_id);
    const rounds = await database.getAllAsync(
      `SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`,
      [roundId, lookbackRounds],
    );
    if (!rounds || !rounds.length) return { activeIds, recentIds: [] };
    const rids = rounds.map((r: any) => r.id);
    const placeholders = rids.map(() => '?').join(',');
    const rows3 = await database.getAllAsync(
      `SELECT DISTINCT player_id FROM round_players WHERE round_id IN (${placeholders}) AND active = 1;`,
      rids,
    );
    const recentIds = (rows3 || []).map((r: any) => r.player_id);
    return { activeIds, recentIds };
  }
  return { activeIds: [], recentIds: [] };
}

export async function getRecentPairCounts(
  roundId: number,
  lookbackRounds = 3,
): Promise<Record<string, number>> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rounds = await database.getAllAsync(
      `SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`,
      [roundId, lookbackRounds],
    );
    if (!rounds || !rounds.length) return {};
    const rids = rounds.map((r: any) => r.id);
    const placeholders = rids.map(() => '?').join(',');
    const gids = await database.getAllAsync(
      `SELECT id FROM groups WHERE round_id IN (${placeholders});`,
      rids,
    );
    if (!gids || !gids.length) return {};
    const groupIds = gids.map((g: any) => g.id);
    const placeholders2 = groupIds.map(() => '?').join(',');
    const rows3 = await database.getAllAsync(
      `SELECT gp1.player_id as a, gp2.player_id as b FROM group_players gp1 JOIN group_players gp2 ON gp1.group_id = gp2.group_id AND gp1.player_id < gp2.player_id WHERE gp1.group_id IN (${placeholders2});`,
      groupIds,
    );
    const counts: Record<string, number> = {};
    for (const row of rows3 || []) {
      const key = `${row.a}:${row.b}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
  return {};
}

export async function setPlayerActiveForRound(
  roundId: number,
  playerId: number,
  active: boolean,
): Promise<void> {
  const database = await openDb();
  if (typeof database.runAsync === 'function') {
    await database.runAsync(
      `INSERT OR REPLACE INTO round_players (round_id, player_id, active) VALUES (?, ?, ?);`,
      roundId,
      playerId,
      active ? 1 : 0,
    );
    return;
  }
  if (typeof database.execAsync === 'function') {
    await database.execAsync(
      `INSERT OR REPLACE INTO round_players (round_id, player_id, active) VALUES (${roundId}, ${playerId}, ${
        active ? 1 : 0
      });`,
    );
    return;
  }
  throw new Error('No suitable async DB API available to set player active flag');
}

export async function getPlayersForRound(roundId: number | null): Promise<PlayerWithActive[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    if (roundId == null) {
      const rows = await database.getAllAsync(
        `SELECT id, name, speedIndex, IFNULL(available, 1) as available, email FROM players WHERE available = 1;`,
      );
      return (rows || [])
        .map(
          (r: any) =>
            ({
              id: r.id,
              name: r.name,
              speedIndex: Number(r.speedIndex),
              active: false,
              email: r.email ?? null,
            } as any),
        )
        .map((p: any, i: number) => ({ ...p, available: !!rows[i].available }));
    }
    const rows = await database.getAllAsync(
      `SELECT p.id, p.name, p.speedIndex, IFNULL(rp.active, 0) as active, IFNULL(p.available, 1) as available, p.email FROM players p LEFT JOIN round_players rp ON p.id = rp.player_id AND rp.round_id = ?;`,
      [roundId],
    );
    return (rows || [])
      .map(
        (r: any) =>
          ({
            id: r.id,
            name: r.name,
            speedIndex: Number(r.speedIndex),
            active: !!r.active,
            email: r.email ?? null,
          } as any),
      )
      .map((p: any, i: number) => ({ ...p, available: !!rows[i].available }));
  }
  return [];
}

export async function getPlayers(onlyAvailable?: boolean): Promise<Player[]> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const sql = !onlyAvailable
      ? `SELECT id, name, speedIndex, IFNULL(available, 1) as available, email FROM players ORDER BY name;`
      : `SELECT id, name, speedIndex, IFNULL(available, 1) as available, email FROM players WHERE available = 1 ORDER BY name;`;
    const rows = await database.getAllAsync(sql);
    return (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      speedIndex: typeof r.speedIndex === 'number' ? r.speedIndex : Number(r.speedIndex),
      available: r.available === 1,
      email: r.email ?? null,
    }));
  }
  return [];
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const database = await openDb();
  if (typeof database.getAllAsync === 'function') {
    const rows = await database.getAllAsync(
      `SELECT id, name, speedIndex, IFNULL(available, 1) as available, email FROM players WHERE id = ? LIMIT 1;`,
      [id],
    );
    if (!rows || !rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      speedIndex: typeof r.speedIndex === 'number' ? r.speedIndex : Number(r.speedIndex),
      available: r.available === 1,
      email: r.email ?? null,
    };
  }
  return null;
}

export async function updatePlayerById(
  id: number,
  fields: { name?: string; speedIndex?: number; available?: boolean },
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
  if ((fields as any).email !== undefined) {
    sets.push('email = ?');
    params.push((fields as any).email);
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

export async function setGroupsForRound(roundId: number, groups: Group[]): Promise<void> {
  const database = await openDb();
  const now = new Date().toISOString();

  // Prefer transactional APIs when available
  //if (typeof database.withTransactionAsync === 'function') {
  //  await database.withTransactionAsync(async (txn: any) => {
  //    await txn.execAsync(
  //      `DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ?);`,
  //      [roundId],
  //    );
  //    await txn.execAsync(`DELETE FROM groups WHERE round_id = ?;`, [roundId]);
  //
  //    for (const g of groups || []) {
  //      const r = await txn.execAsync(
  //        `INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);`,
  //        [roundId, g.slot_index, now],
  //      );
  //      const gid = (r && ((r as any).insertId ?? (r as any).lastInsertRowId)) as number | undefined;
  //      if (gid) {
  //        for (const p of g.players || []) {
  //          await txn.execAsync(`INSERT INTO group_players (group_id, player_id) VALUES (?, ?);`, [
  //            gid,
  //            p.id,
  //          ]);
  //        }
  //      }
  //    }
  //  });
  //  return;
  //}

  // Use parameterized runAsync if available
  if (typeof database.runAsync === 'function') {
    await database.runAsync(
      `DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ?);`,
      roundId,
    );
    await database.runAsync(`DELETE FROM groups WHERE round_id = ?;`, roundId);

    for (const g of groups || []) {
      const r = await database.runAsync(
        `INSERT INTO groups (round_id, slot_index, created_at) VALUES (?, ?, ?);`,
        roundId,
        g.slot_index,
        now,
      );
      const gid = r?.lastInsertRowId ?? r?.insertId;
      if (gid) {
        for (const p of g.players || []) {
          await database.runAsync(
            `INSERT INTO group_players (group_id, player_id) VALUES (?, ?);`,
            gid,
            p.id,
          );
        }
      }
    }
    return;
  }

  // Fallback to execAsync (raw SQL)
  if (typeof database.execAsync === 'function') {
    await database.execAsync(
      `DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ${roundId});`,
    );
    await database.execAsync(`DELETE FROM groups WHERE round_id = ${roundId};`);

    for (const g of groups || []) {
      await database.execAsync(
        `INSERT INTO groups (round_id, slot_index, created_at) VALUES (${roundId}, ${g.slot_index}, '${now}');`,
      );

      let gid: number | undefined;
      if (typeof database.getAllAsync === 'function') {
        const rows = await database.getAllAsync(`SELECT last_insert_rowid() as id;`);
        gid = rows && rows[0] && rows[0].id ? Number(rows[0].id) : undefined;
      }

      if (gid) {
        for (const p of g.players || []) {
          await database.execAsync(
            `INSERT INTO group_players (group_id, player_id) VALUES (${gid}, ${p.id});`,
          );
        }
      }
    }
    return;
  }

  throw new Error('No suitable async DB API available to set groups for round');
}
