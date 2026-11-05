import type { StorageDriver, StoredRow, StoredWrite } from '@commontab/core';

const DATABASE = 'commontab';
const STORE = 'rows';

const done = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

export async function openDriver(): Promise<StorageDriver & { clear(): Promise<void> }> {
  const opening = indexedDB.open(DATABASE, 1);
  opening.onupgradeneeded = () => void opening.result.createObjectStore(STORE);
  const db = await done(opening);
  return {
    load: async () => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const [keys, values] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
      return keys.map((id, i): StoredRow => {
        const [table, ...rest] = String(id).split('/');
        return { table: table as StoredRow['table'], key: rest.join('/'), json: values[i] as string };
      });
    },
    commit: (writes: StoredWrite[]) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const w of writes) {
        const id = `${w.table}/${w.key}`;
        if (w.json === null) store.delete(id);
        else store.put(w.json, id);
      }
      return finished(tx);
    },
    clear: () => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      return finished(tx);
    },
  };
}
