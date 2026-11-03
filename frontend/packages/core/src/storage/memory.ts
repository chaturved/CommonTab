import type { OutboxEntry } from '../outbox/types';
import type { LocalExpense, LocalGroup, LocalSettlement, Storage, Store } from './types';

interface Tables {
  groups: Map<string, LocalGroup>;
  expenses: Map<string, LocalExpense>;
  settlements: Map<string, LocalSettlement>;
  outbox: Map<string, OutboxEntry>;
  meta: Map<string, string>;
}

const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

function cloneTables(t: Tables): Tables {
  return {
    groups: new Map(t.groups), expenses: new Map(t.expenses), settlements: new Map(t.settlements),
    outbox: new Map(t.outbox), meta: new Map(t.meta),
  };
}

/** Reference `Storage` for tests and for the web before IndexedDB. Values are copied in and out. */
export class MemoryStorage implements Storage {
  private tables: Tables = {
    groups: new Map(), expenses: new Map(), settlements: new Map(), outbox: new Map(), meta: new Map(),
  };
  private queue: Promise<unknown> = Promise.resolve();

  /** Transactions run one at a time; a thrown error rolls every write back. */
  transaction<T>(work: (tx: Store) => Promise<T>): Promise<T> {
    const run = async () => {
      const draft = cloneTables(this.tables);
      const result = await work(this.view(draft));
      this.tables = draft;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private view(t: Tables): Store {
    const byGroup = <T extends { groupID?: string }>(map: Map<string, T>, id: string) =>
      [...map.values()].filter((row) => row.groupID === id).map(copy);
    return {
      getGroup: async (id) => copy(t.groups.get(id)),
      putGroup: async (group) => void t.groups.set(group.id, copy(group)),
      listGroups: async () => [...t.groups.values()].map(copy),
      getExpense: async (id) => copy(t.expenses.get(id)),
      putExpense: async (e) => void t.expenses.set(e.id, copy(e)),
      deleteExpense: async (id) => void t.expenses.delete(id),
      listExpenses: async (groupId) => byGroup(t.expenses, groupId),
      getSettlement: async (id) => copy(t.settlements.get(id)),
      putSettlement: async (s) => void t.settlements.set(s.id, copy(s)),
      deleteSettlement: async (id) => void t.settlements.delete(id),
      listSettlements: async (groupId) => byGroup(t.settlements, groupId),
      listOutbox: async () => [...t.outbox.values()].sort((a, b) => a.seq - b.seq).map(copy),
      putOutbox: async (entry) => void t.outbox.set(entry.opId, copy(entry)),
      deleteOutbox: async (opId) => void t.outbox.delete(opId),
      getMeta: async (key) => t.meta.get(key),
      setMeta: async (key, value) => void t.meta.set(key, value),
    };
  }

  // Reads outside a transaction see the last committed state.
  private get committed(): Store { return this.view(this.tables); }
  getGroup = (id: string) => this.committed.getGroup(id);
  putGroup = (g: LocalGroup) => this.transaction((tx) => tx.putGroup(g));
  listGroups = () => this.committed.listGroups();
  getExpense = (id: string) => this.committed.getExpense(id);
  putExpense = (e: LocalExpense) => this.transaction((tx) => tx.putExpense(e));
  deleteExpense = (id: string) => this.transaction((tx) => tx.deleteExpense(id));
  listExpenses = (groupId: string) => this.committed.listExpenses(groupId);
  getSettlement = (id: string) => this.committed.getSettlement(id);
  putSettlement = (s: LocalSettlement) => this.transaction((tx) => tx.putSettlement(s));
  deleteSettlement = (id: string) => this.transaction((tx) => tx.deleteSettlement(id));
  listSettlements = (groupId: string) => this.committed.listSettlements(groupId);
  listOutbox = () => this.committed.listOutbox();
  putOutbox = (entry: OutboxEntry) => this.transaction((tx) => tx.putOutbox(entry));
  deleteOutbox = (opId: string) => this.transaction((tx) => tx.deleteOutbox(opId));
  getMeta = (key: string) => this.committed.getMeta(key);
  setMeta = (key: string, value: string) => this.transaction((tx) => tx.setMeta(key, value));
}
