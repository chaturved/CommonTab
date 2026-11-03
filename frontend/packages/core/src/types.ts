import type { Allocation } from './splitter';

export interface Clock {
  now(): number;
}

export interface Random {
  uuid(): string;
  next(): number;
}

export type WireMethod = 'equal' | 'exact' | 'percentage';

export interface Member {
  id: string;
  name: string;
  userID: string | null;
  email: string | null;
}

export interface ExpenseInput {
  id: string;
  merchant: string;
  occurredAt: string;
  category: string;
  notes: string;
  amountMinor: number;
  payerID: string;
  method: WireMethod;
  participants: string[];
  values: string[];
  version: number | null;
}

export type ExpenseContent = Omit<ExpenseInput, 'version'>;

export interface WireExpense {
  id: string;
  groupID: string;
  merchant: string;
  occurredAt: string;
  category: string;
  notes: string;
  amountMinor: number;
  payerID: string;
  method: WireMethod;
  allocations: Allocation[];
  values: string[];
  version: number;
  hasReceipt: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WireSettlement {
  id: string;
  groupID: string;
  fromID: string;
  toID: string;
  amountMinor: number;
  createdAt: string;
}

export interface SettlementInput {
  id: string;
  fromID: string;
  toID: string;
  amountMinor: number;
}

export interface GroupSnapshot {
  id: string;
  name: string;
  currencyCode: string;
  ownerID: string;
  meMemberID: string;
  version: number;
  members: Member[];
  expenses: WireExpense[];
  deletedExpenses: WireExpense[];
  settlements: WireSettlement[];
  balances: { memberID: string; minorUnits: number }[];
}

export interface GroupCreateInput {
  id: string;
  name: string;
  currencyCode: string;
  members: { id: string; name: string }[];
  meMemberID: string;
}
