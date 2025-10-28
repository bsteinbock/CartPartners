// exportDbToCsv.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cart-partners.db';

// Ensure we only open one DB instance
let db: SQLite.SQLiteDatabase | null = null;
function getDb() {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

/**
 * Export all tables in the database to CSV files.
 * CSV files will be written to FileSystem.documentDirectory
 */
export async function exportAllTablesToCsv() {
  const db = getDb();

  // 1️⃣ Get list of all user tables
  const tables = db
    .getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`,
    )
    .map((t) => t.name);

  const exportDir = `${FileSystem.documentDirectory}db_exports`;
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

  // 2️⃣ Loop through each table and dump to CSV
  for (const table of tables) {
    try {
      const rows = db.getAllSync<Record<string, any>>(`SELECT * FROM ${table};`);
      if (rows.length === 0) {
        console.log(`Skipping empty table: ${table}`);
        continue;
      }

      // Extract headers and CSV rows
      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(',')];

      for (const row of rows) {
        const values = headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') {
            // Escape quotes and commas
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvRows.push(values.join(','));
      }

      const csvData = csvRows.join('\n');
      const filePath = `${exportDir}/${table}.csv`;

      await FileSystem.writeAsStringAsync(filePath, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log(`✅ Exported ${table} -> ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to export table ${table}:`, err);
    }
  }

  console.log(`🎉 Export complete! CSVs are saved under: ${exportDir}`);
}
