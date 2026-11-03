import type { ExpenseContent, GroupSnapshot, Member, WireExpense, WireSettlement } from '../types';
import type { OutboxEntry } from '../outbox/types';

export type SyncState = 'synced' | 'pending' | 'failed' | 'conflict';

export interface SyncError {
  status: number;
  code: string | null;
  message: string;
  maxAmountMinor?: number;
}

export interface HistoryEntry {
  at: string;
  reason: 'edited_elsewhere' | 'you_chose_theirs' | 'overwritten_by_you';
  record: WireExpense | LocalContent;
}

export interface LocalContent extends ExpenseContent {
  groupID: string;
  allocations: WireExpense['allocations'];
  editedAt: string;
}

export interface LocalGroup {
  id: string;
  name: string;
  currencyCode: string;
  ownerID: string;
  meMemberID: string;
  version: number | null;
  members: Member[];
  syncState: SyncState;
  localOnly: boolean;
}

export interface LocalExpense extends WireExpense {
  syncState: SyncState;
  error?: SyncError;
  conflict?: { mine: LocalContent };
  history: HistoryEntry[];
}

export interface LocalSettlement extends WireSettlement {
  syncState: SyncState;
  error?: SyncError;
}

export interface Store {
  getGroup(id: string): Promise<LocalGroup | undefined>;
  putGroup(group: LocalGroup): Promise<void>;
  listGroups(): Promise<LocalGroup[]>;

  getExpense(id: string): Promise<LocalExpense | undefined>;
  putExpense(expense: LocalExpense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  listExpenses(groupId: string): Promise<LocalExpense[]>;

  getSettlement(id: string): Promise<LocalSettlement | undefined>;
  putSettlement(settlement: LocalSettlement): Promise<void>;
  deleteSettlement(id: string): Promise<void>;
  listSettlements(groupId: string): Promise<LocalSettlement[]>;

  listOutbox(): Promise<OutboxEntry[]>;
  putOutbox(entry: OutboxEntry): Promise<void>;
  deleteOutbox(opId: string): Promise<void>;

  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}

export interface Storage extends Store {
  /**
   * Run `work` atomically: all writes apply or none do, and transactions never interleave.
   * A local change and its outbox entry always go through one call.
   */
  transaction<T>(work: (tx: Store) => Promise<T>): Promise<T>;
}

export type { GroupSnapshot };
