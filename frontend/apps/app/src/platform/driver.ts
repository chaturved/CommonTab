import * as SQLite from 'expo-sqlite';
import type { StorageDriver, StoredRow, StoredWrite } from '@commontab/core';

const DATABASE = 'commontab.db';

export async function openDriver(): Promise<StorageDriver & { clear(): Promise<void> }> {
  const db = await SQLite.openDatabaseAsync(DATABASE);
  await db.execAsync('CREATE TABLE IF NOT EXISTS rows (tbl TEXT NOT NULL, key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (tbl, key))');
  return {
    load: () => db.getAllAsync<{ tbl: StoredRow['table']; key: string; json: string }>('SELECT tbl, key, json FROM rows')
      .then((rows) => rows.map((r) => ({ table: r.tbl, key: r.key, json: r.json }))),
    commit: (writes: StoredWrite[]) => db.withTransactionAsync(async () => {
      for (const w of writes) {
        if (w.json === null) await db.runAsync('DELETE FROM rows WHERE tbl = ? AND key = ?', w.table, w.key);
        else await db.runAsync('INSERT OR REPLACE INTO rows (tbl, key, json) VALUES (?, ?, ?)', w.table, w.key, w.json);
      }
    }),
    clear: () => db.execAsync('DELETE FROM rows'),
  };
}
