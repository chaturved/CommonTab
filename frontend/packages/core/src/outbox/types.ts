import type { ExpenseInput, GroupCreateInput, SettlementInput } from '../types';

export type OutboxKind = 'group.create' | 'member.put' | 'expense.put' | 'expense.delete' | 'settlement.create';

export type OutboxStatus = 'ready' | 'failed' | 'conflict';

export type OutboxPayload =
  | { kind: 'group.create'; group: GroupCreateInput }
  | { kind: 'member.put'; memberID: string; name: string }
  | { kind: 'expense.put'; expense: ExpenseInput }
  | { kind: 'expense.delete' }
  | { kind: 'settlement.create'; settlement: SettlementInput };

export interface OutboxEntry {
  opId: string;
  seq: number;
  kind: OutboxKind;
  groupId: string;
  entityId: string;
  payload: OutboxPayload;
  baseVersion: number | null;
  createdAt: number;
  editedAt: number;
  lastAttemptAt: number | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
  status: OutboxStatus;
}
