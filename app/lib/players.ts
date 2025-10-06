import * as SQLite from 'expo-sqlite';

export type Player = {
  id?: number;
  name: string;
  speedIndex: number;
};

export type PlayerWithActive = Player & { id: number; active: boolean };

export type Round = {
  id: number;
  date: string; // ISO
  status: 'completed' | 'pending' | 'canceled';
};

const DB_NAME = 'players.db';

let db: SQLite.WebSQLDatabase | null = null;

function openDb() {
  if (!db) db = SQLite.openDatabase(DB_NAME);
  return db!;
}

export function initDb(): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, speedIndex REAL NOT NULL);`
        );
        // rounds table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, status TEXT NOT NULL);`
        );
        // round_players joins players to rounds and stores whether they're active for that round
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS round_players (round_id INTEGER NOT NULL, player_id INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (round_id, player_id));`
        );
        // groups table - groupings for a given round
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL, created_at TEXT NOT NULL);`
        );
        // group_players maps group -> player (cart and slot)
        // cart_index: 1 or 2 (two carts), slot_index: 1 or 2 (up to two players per cart)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS group_players (group_id INTEGER NOT NULL, player_id INTEGER NOT NULL, cart_index INTEGER NOT NULL, slot_index INTEGER NOT NULL, PRIMARY KEY (group_id, cart_index, slot_index));`
        );
        // simple key/value meta table for storing app-wide settings (e.g. active round)
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`
        );
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

export function addPlayer(player: Player): Promise<number> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `INSERT INTO players (name, speedIndex) VALUES (?, ?);`,
          [player.name, player.speedIndex],
          (_: any, result: any) => {
            const insertId = result && result.insertId ? result.insertId : undefined;
            resolve(insertId);
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}

// create a new round and return its id
export function createRound(status: Round['status'] = 'pending'): Promise<number> {
  const database = openDb();
  const date = new Date().toISOString();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `INSERT INTO rounds (date, status) VALUES (?, ?);`,
          [date, status],
          (_: any, result: any) => {
            const insertId = result && result.insertId ? result.insertId : undefined;
            resolve(insertId);
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}

export function getRounds(): Promise<Round[]> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`SELECT id, date, status FROM rounds ORDER BY id DESC;`, [], (_: any, result: any) => {
          const rows: any[] = (result && result.rows && result.rows._array) || [];
          const rounds: Round[] = rows.map((r: any) => ({ id: r.id, date: r.date, status: r.status }));
          resolve(rounds);
        });
      },
      (err: any) => reject(err)
    );
  });
}

export type RoundSummary = Round & { activeCount: number };

export function getRoundSummaries(): Promise<RoundSummary[]> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `SELECT r.id, r.date, r.status, COUNT(CASE WHEN rp.active = 1 THEN 1 END) as activeCount FROM rounds r LEFT JOIN round_players rp ON r.id = rp.round_id GROUP BY r.id ORDER BY r.id DESC;`,
          [],
          (_: any, result: any) => {
            const rows: any[] = (result && result.rows && result.rows._array) || [];
            const summaries: RoundSummary[] = rows.map((r: any) => ({ id: r.id, date: r.date, status: r.status, activeCount: Number(r.activeCount || 0) }));
            resolve(summaries);
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}

// copy active players (active=1) from sourceRoundId into targetRoundId
export function copyActivePlayersToRound(sourceRoundId: number, targetRoundId: number): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        // insert or replace entries for players who were active in source
        tx.executeSql(
          `INSERT OR REPLACE INTO round_players (round_id, player_id, active) SELECT ?, rp.player_id, rp.active FROM round_players rp WHERE rp.round_id = ? AND rp.active = 1;`,
          [targetRoundId, sourceRoundId]
        );
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// --- Groups helpers ---
export function createGroupForRound(roundId: number): Promise<number> {
  const database = openDb();
  const date = new Date().toISOString();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`INSERT INTO groups (round_id, created_at) VALUES (?, ?);`, [roundId, date], (_: any, result: any) => {
          const insertId = result && result.insertId ? result.insertId : undefined;
          resolve(insertId);
        });
      },
      (err: any) => reject(err)
    );
  });
}

export function addPlayersToGroup(groupId: number, players: { player_id: number; cart_index: number; slot_index: number }[]): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        for (const p of players) {
          tx.executeSql(`INSERT OR REPLACE INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, [groupId, p.player_id, p.cart_index, p.slot_index]);
        }
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

export type Group = { id: number; round_id: number; created_at: string; players: { player_id: number; cart_index: number; slot_index: number; name?: string; speedIndex?: number }[] };

export function getGroupsForRound(roundId: number): Promise<Group[]> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`SELECT id, round_id, created_at FROM groups WHERE round_id = ? ORDER BY id DESC;`, [roundId], (_: any, result: any) => {
          const rows: any[] = (result && result.rows && result.rows._array) || [];
          const groups: Group[] = rows.map((r: any) => ({ id: r.id, round_id: r.round_id, created_at: r.created_at, players: [] }));
          if (!groups.length) {
            resolve([]);
            return;
          }
          const ids = groups.map((g) => g.id);
          const placeholders = ids.map(() => '?').join(',');
          tx.executeSql(
            `SELECT gp.group_id, gp.player_id, gp.cart_index, gp.slot_index, p.name, p.speedIndex FROM group_players gp JOIN players p ON p.id = gp.player_id WHERE gp.group_id IN (${placeholders}) ORDER BY gp.group_id, gp.cart_index, gp.slot_index;`,
            ids,
            (_2: any, res2: any) => {
              const rows2: any[] = (res2 && res2.rows && res2.rows._array) || [];
              for (const row of rows2) {
                const g = groups.find((gg) => gg.id === row.group_id);
                if (g) g.players.push({ player_id: row.player_id, cart_index: row.cart_index, slot_index: row.slot_index, name: row.name, speedIndex: typeof row.speedIndex === 'number' ? row.speedIndex : Number(row.speedIndex) });
              }
              resolve(groups);
            }
          );
        });
      },
      (err: any) => reject(err)
    );
  });
}

// delete a single group and its entries
export function deleteGroupById(groupId: number): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`DELETE FROM group_players WHERE group_id = ?;`, [groupId]);
        tx.executeSql(`DELETE FROM groups WHERE id = ?;`, [groupId]);
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// delete all groups for a round
export function deleteGroupsForRound(roundId: number): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        // delete group_players for groups in this round
        tx.executeSql(`DELETE FROM group_players WHERE group_id IN (SELECT id FROM groups WHERE round_id = ?);`, [roundId]);
        tx.executeSql(`DELETE FROM groups WHERE round_id = ?;`, [roundId]);
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// Replace group_players entries for a group with a new ordered list
export function updateGroupPlayers(groupId: number, players: { player_id: number; cart_index: number; slot_index: number }[]): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`DELETE FROM group_players WHERE group_id = ?;`, [groupId]);
        for (const p of players) {
          tx.executeSql(`INSERT INTO group_players (group_id, player_id, cart_index, slot_index) VALUES (?, ?, ?, ?);`, [groupId, p.player_id, p.cart_index, p.slot_index]);
        }
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// Return player ids active for the given round and optionally recent player ids from previous N rounds
export async function getRecentActivePlayerIds(roundId: number, lookbackRounds = 3): Promise<{ activeIds: number[]; recentIds: number[] }> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`SELECT player_id FROM round_players WHERE round_id = ? AND active = 1;`, [roundId], (_: any, result: any) => {
          const rows: any[] = (result && result.rows && result.rows._array) || [];
          const activeIds = rows.map((r: any) => r.player_id);
          // get previous N rounds
          tx.executeSql(
            `SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`,
            [roundId, lookbackRounds],
            (_2: any, res2: any) => {
              const rounds: any[] = (res2 && res2.rows && res2.rows._array) || [];
              if (!rounds.length) {
                resolve({ activeIds, recentIds: [] });
                return;
              }
              const rids = rounds.map((r: any) => r.id);
              const placeholders = rids.map(() => '?').join(',');
              tx.executeSql(
                `SELECT DISTINCT player_id FROM round_players WHERE round_id IN (${placeholders}) AND active = 1;`,
                rids,
                (_3: any, res3: any) => {
                  const rows3: any[] = (res3 && res3.rows && res3.rows._array) || [];
                  const recentIds = rows3.map((r: any) => r.player_id);
                  resolve({ activeIds, recentIds });
                }
              );
            }
          );
        });
      },
      (err: any) => reject(err)
    );
  });
}

// Return pair counts for players who were grouped together in the last `lookbackRounds` rounds before roundId
export function getRecentPairCounts(roundId: number, lookbackRounds = 3): Promise<Record<string, number>> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        // get last N round ids before the current round
        tx.executeSql(`SELECT id FROM rounds WHERE id < ? ORDER BY id DESC LIMIT ?;`, [roundId, lookbackRounds], (_: any, res: any) => {
          const rounds: any[] = (res && res.rows && res.rows._array) || [];
          if (!rounds.length) { resolve({}); return; }
          const rids = rounds.map((r: any) => r.id);
          const placeholders = rids.map(() => '?').join(',');
          // get groups belonging to those rounds
          tx.executeSql(`SELECT id FROM groups WHERE round_id IN (${placeholders});`, rids, (_2: any, res2: any) => {
            const gids: any[] = (res2 && res2.rows && res2.rows._array) || [];
            if (!gids.length) { resolve({}); return; }
            const groupIds = gids.map((g: any) => g.id);
            const placeholders2 = groupIds.map(() => '?').join(',');
            // select pairs within same group (p1 < p2) and count occurrences
            tx.executeSql(
              `SELECT gp1.player_id as a, gp2.player_id as b FROM group_players gp1 JOIN group_players gp2 ON gp1.group_id = gp2.group_id AND gp1.player_id < gp2.player_id WHERE gp1.group_id IN (${placeholders2});`,
              groupIds,
              (_3: any, res3: any) => {
                const rows3: any[] = (res3 && res3.rows && res3.rows._array) || [];
                const counts: Record<string, number> = {};
                for (const row of rows3) {
                  const key = `${row.a}:${row.b}`;
                  counts[key] = (counts[key] || 0) + 1;
                }
                resolve(counts);
              }
            );
          });
        });
      },
      (err: any) => reject(err)
    );
  });
}

export function setRoundStatus(id: number, status: Round['status']): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`UPDATE rounds SET status = ? WHERE id = ?;`, [status, id]);
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

export function setActiveRound(id: number | null): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        if (id == null) {
          tx.executeSql(`DELETE FROM meta WHERE key = ?;`, ['active_round']);
        } else {
          tx.executeSql(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);`, ['active_round', String(id)]);
        }
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

export function getActiveRound(): Promise<number | null> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`SELECT value FROM meta WHERE key = ? LIMIT 1;`, ['active_round'], (_: any, result: any) => {
          const rows = (result && result.rows && result.rows._array) || [];
          if (rows.length) resolve(rows[0].value ? Number(rows[0].value) : null);
          else resolve(null);
        });
      },
      (err: any) => reject(err)
    );
  });
}

// set active flag for a player for a specific round
export function setPlayerActiveForRound(roundId: number, playerId: number, active: boolean): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO round_players (round_id, player_id, active) VALUES (?, ?, ?);`,
          [roundId, playerId, active ? 1 : 0]
        );
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// fetch all players with their active state for a given round (if roundId null, active=false)
export function getPlayersForRound(roundId: number | null): Promise<PlayerWithActive[]> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        if (roundId == null) {
          tx.executeSql(`SELECT id, name, speedIndex FROM players;`, [], (_: any, result: any) => {
            const rows: any[] = (result && result.rows && result.rows._array) || [];
            const players: PlayerWithActive[] = rows.map((r: any) => ({ id: r.id, name: r.name, speedIndex: Number(r.speedIndex), active: false }));
            resolve(players);
          });
        } else {
          tx.executeSql(
            `SELECT p.id, p.name, p.speedIndex, IFNULL(rp.active, 0) as active FROM players p LEFT JOIN round_players rp ON p.id = rp.player_id AND rp.round_id = ?;`,
            [roundId],
            (_: any, result: any) => {
              const rows: any[] = (result && result.rows && result.rows._array) || [];
              const players: PlayerWithActive[] = rows.map((r: any) => ({ id: r.id, name: r.name, speedIndex: Number(r.speedIndex), active: !!r.active }));
              resolve(players);
            }
          );
        }
      },
      (err: any) => reject(err)
    );
  });
}

export function getPlayers(): Promise<Player[]> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(
          `SELECT name, speedIndex FROM players;`,
          [],
          (_: any, result: any) => {
            const rows: any[] = (result && result.rows && result.rows._array) || [];
            const players: Player[] = rows.map((r: any) => ({
              name: r.name,
              speedIndex: typeof r.speedIndex === 'number' ? r.speedIndex : Number(r.speedIndex),
            }));
            resolve(players);
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}

// update player by id
export function updatePlayerById(id: number, fields: { name?: string; speedIndex?: number }): Promise<void> {
  const database = openDb();
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
  if (!sets.length) return Promise.resolve();
  params.push(id);
  const sql = `UPDATE players SET ${sets.join(', ')} WHERE id = ?;`;
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(sql, params);
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}

// delete player and any round_players entries
export function deletePlayerById(id: number): Promise<void> {
  const database = openDb();
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        tx.executeSql(`DELETE FROM round_players WHERE player_id = ?;`, [id]);
        tx.executeSql(`DELETE FROM players WHERE id = ?;`, [id]);
      },
      (err: any) => reject(err),
      () => resolve()
    );
  });
}
// (name-based helper removed — use explicit ids)
