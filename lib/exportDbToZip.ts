// exportDbToCsv.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
//import * as Zip from 'expo-zip';

const DB_NAME = 'cart-partners.db';

let db: SQLite.SQLiteDatabase | null = null;
function getDb() {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

/**
 * Export all tables to CSV and bundle into a single ZIP file.
 * Returns the path to the generated ZIP file.
 */
export async function exportAllTablesToCsvZip(): Promise<string> {
  const db = getDb();

  // 1️⃣ Get all user-defined tables
  const tables = db
    .getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`,
    )
    .map((t) => t.name);

  const exportDir = `${FileSystem.documentDirectory}db_exports`;
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

  const csvFiles: string[] = [];

  // 2️⃣ Dump each table to CSV
  for (const table of tables) {
    try {
      const rows = db.getAllSync<Record<string, any>>(`SELECT * FROM ${table};`);
      if (rows.length === 0) {
        console.log(`Skipping empty table: ${table}`);
        continue;
      }

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

      csvFiles.push(filePath);
      console.log(`✅ Exported ${table} -> ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to export table ${table}:`, err);
    }
  }

  if (csvFiles.length === 0) {
    throw new Error('No tables were exported.');
  }

  // 3️⃣ Zip all CSV files together
  const zipPath = `${FileSystem.documentDirectory}cart-partners-db-export.zip`;

  //await Zip.zip(exportDir, zipPath);
  //console.log(`🎉 Export complete! ZIP created at: ${zipPath}`);

  return zipPath;
}

/*
import { exportAllTablesToCsvZip } from '../db/exportDbToCsv';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

async function handleExportPress() {
  try {
    const zipPath = await exportAllTablesToCsvZip();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Share database export',
      });
    } else {
      alert(`Export complete! File saved at:\n${zipPath}`);
    }
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed. Check console for details.');
  }
}

*/
