import type { OutboxEntry } from '../outbox/types';
import { MemoryStorage } from './memory';
import type { LocalExpense, LocalGroup, LocalSettlement, Storage, Store } from './types';

export type Table = 'groups' | 'expenses' | 'settlements' | 'outbox' | 'meta';

export interface StoredRow {
  table: Table;
  key: string;
  json: string;
}

export interface StoredWrite {
  table: Table;
  key: string;
  json: string | null;
}

export interface StorageDriver {
  load(): Promise<StoredRow[]>;
  commit(writes: StoredWrite[]): Promise<void>;
}

export class PersistentStorage implements Storage {
  private constructor(private readonly memory: MemoryStorage, private readonly driver: StorageDriver) {}

  static async open(driver: StorageDriver): Promise<PersistentStorage> {
    const memory = new MemoryStorage();
    const rows = await driver.load();
    await memory.transaction(async (tx) => {
      for (const { table, key, json } of rows) {
        const value: unknown = JSON.parse(json);
        if (table === 'groups') await tx.putGroup(value as LocalGroup);
        else if (table === 'expenses') await tx.putExpense(value as LocalExpense);
        else if (table === 'settlements') await tx.putSettlement(value as LocalSettlement);
        else if (table === 'outbox') await tx.putOutbox(value as OutboxEntry);
        else await tx.setMeta(key, value as string);
      }
    });
    return new PersistentStorage(memory, driver);
  }

  transaction<T>(work: (tx: Store) => Promise<T>): Promise<T> {
    return this.memory.transaction(async (tx) => {
      const writes: StoredWrite[] = [];
      const result = await work(recording(tx, writes));
      if (writes.length > 0) await this.driver.commit(writes);
      return result;
    });
  }

  getGroup = (id: string) => this.memory.getGroup(id);
  putGroup = (g: LocalGroup) => this.transaction((tx) => tx.putGroup(g));
  listGroups = () => this.memory.listGroups();
  deleteGroup = (id: string) => this.transaction((tx) => tx.deleteGroup(id));
  getExpense = (id: string) => this.memory.getExpense(id);
  putExpense = (e: LocalExpense) => this.transaction((tx) => tx.putExpense(e));
  deleteExpense = (id: string) => this.transaction((tx) => tx.deleteExpense(id));
  listExpenses = (groupId: string) => this.memory.listExpenses(groupId);
  getSettlement = (id: string) => this.memory.getSettlement(id);
  putSettlement = (s: LocalSettlement) => this.transaction((tx) => tx.putSettlement(s));
  deleteSettlement = (id: string) => this.transaction((tx) => tx.deleteSettlement(id));
  listSettlements = (groupId: string) => this.memory.listSettlements(groupId);
  listOutbox = () => this.memory.listOutbox();
  putOutbox = (entry: OutboxEntry) => this.transaction((tx) => tx.putOutbox(entry));
  deleteOutbox = (opId: string) => this.transaction((tx) => tx.deleteOutbox(opId));
  getMeta = (key: string) => this.memory.getMeta(key);
  setMeta = (key: string, value: string) => this.transaction((tx) => tx.setMeta(key, value));
}

async function forgetGroup(tx: Store, id: string, remove: (table: Table, key: string) => void): Promise<void> {
  for (const e of await tx.listExpenses(id)) remove('expenses', e.id);
  for (const s of await tx.listSettlements(id)) remove('settlements', s.id);
  for (const o of await tx.listOutbox()) if (o.groupId === id) remove('outbox', o.opId);
  remove('groups', id);
}

function recording(tx: Store, writes: StoredWrite[]): Store {
  const put = (table: Table, key: string, value: unknown) => void writes.push({ table, key, json: JSON.stringify(value) });
  const remove = (table: Table, key: string) => void writes.push({ table, key, json: null });
  return {
    ...tx,
    putGroup: async (g) => { await tx.putGroup(g); put('groups', g.id, g); },
    deleteGroup: async (id) => { await forgetGroup(tx, id, remove); await tx.deleteGroup(id); },
    putExpense: async (e) => { await tx.putExpense(e); put('expenses', e.id, e); },
    deleteExpense: async (id) => { await tx.deleteExpense(id); remove('expenses', id); },
    putSettlement: async (s) => { await tx.putSettlement(s); put('settlements', s.id, s); },
    deleteSettlement: async (id) => { await tx.deleteSettlement(id); remove('settlements', id); },
    putOutbox: async (entry) => { await tx.putOutbox(entry); put('outbox', entry.opId, entry); },
    deleteOutbox: async (opId) => { await tx.deleteOutbox(opId); remove('outbox', opId); },
    setMeta: async (key, value) => { await tx.setMeta(key, value); put('meta', key, value); },
  };
}
