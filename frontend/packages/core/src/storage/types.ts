import type { ExpenseContent, GroupSnapshot, Member, WireExpense, WireSettlement } from '../types';
import type { OutboxEntry } from '../outbox/types';

export type SyncState = 'synced' | 'pending' | 'failed' | 'conflict';

/** Why the server refused a change (422, 404 or an id clash). Kept so the Fix/Discard screen can say why. */
export interface SyncError {
  status: number;
  code: string | null;
  message: string;
  /** Set for `exceeds_balance`: the most that can be paid. */
  maxAmountMinor?: number;
}

/** A superseded version of an expense, kept so nothing a person typed is silently lost. */
export interface HistoryEntry {
  at: string;
  reason: 'edited_elsewhere' | 'you_chose_theirs' | 'overwritten_by_you';
  record: WireExpense | LocalContent;
}

/** Content the user wrote locally, with the allocations computed on the device. */
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
  /** Last server version seen; null if never synced. */
  version: number | null;
  members: Member[];
  /** `pending` until uploaded. A local-only group never leaves the device until the person uploads it. */
  syncState: SyncState;
  localOnly: boolean;
}

export interface LocalExpense extends WireExpense {
  syncState: SyncState;
  /** Set when `syncState` is `failed`. */
  error?: SyncError;
  /** Set when `syncState` is `conflict`: `mine` is the edit that lost, this record holds the server's version. */
  conflict?: { mine: LocalContent };
  history: HistoryEntry[];
}

export interface LocalSettlement extends WireSettlement {
  syncState: SyncState;
  error?: SyncError;
}

/**
 * Local store the UI reads. SQLite on mobile and IndexedDB on web implement this.
 * Record-oriented on purpose: no queries beyond "by id" and "by group".
 */
export interface Store {
  getGroup(id: string): Promise<LocalGroup | undefined>;
  putGroup(group: LocalGroup): Promise<void>;
  listGroups(): Promise<LocalGroup[]>;

  getExpense(id: string): Promise<LocalExpense | undefined>;
  putExpense(expense: LocalExpense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** Live expenses and tombstones. */
  listExpenses(groupId: string): Promise<LocalExpense[]>;

  getSettlement(id: string): Promise<LocalSettlement | undefined>;
  putSettlement(settlement: LocalSettlement): Promise<void>;
  deleteSettlement(id: string): Promise<void>;
  listSettlements(groupId: string): Promise<LocalSettlement[]>;

  /** Ordered by `seq`. */
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
