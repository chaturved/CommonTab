import type { ExpenseInput, GroupCreateInput, SettlementInput } from '../types';

export type OutboxKind = 'group.create' | 'member.put' | 'expense.put' | 'expense.delete' | 'settlement.create';

/**
 * `ready` entries are sent. `failed` (422/404/id clash) and `conflict` (409) entries are parked until the
 * person fixes, discards or resolves them; they never block entries for other records.
 */
export type OutboxStatus = 'ready' | 'failed' | 'conflict';

export type OutboxPayload =
  | { kind: 'group.create'; group: GroupCreateInput }
  | { kind: 'member.put'; memberID: string; name: string }
  | { kind: 'expense.put'; expense: ExpenseInput }
  | { kind: 'expense.delete' }
  | { kind: 'settlement.create'; settlement: SettlementInput };

export interface OutboxEntry {
  opId: string;
  /** Position in the queue. Entries for one group are sent in `seq` order. */
  seq: number;
  kind: OutboxKind;
  groupId: string;
  /** The record this change is about; coalescing is per (kind family, entityId). */
  entityId: string;
  payload: OutboxPayload;
  /** The server version the edit was made on top of; null if the record never synced. */
  baseVersion: number | null;
  createdAt: number;
  /** Last local edit; decides newest-edit-wins against the server's `updatedAt`. */
  editedAt: number;
  /** When the last send started; an entry that was never sent can be cancelled without telling the server. */
  lastAttemptAt: number | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
  status: OutboxStatus;
}
