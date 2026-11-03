import type { Allocation } from './splitter';

/** Everything with a side effect is injected, so core runs in Jest and on every platform. */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
}

export interface Random {
  uuid(): string;
  /** A number in [0, 1), used for retry jitter. */
  next(): number;
}

/** Wire format of `docs/shared-api.md`. `percentage` on the wire is `percent` in the splitter. */
export type WireMethod = 'equal' | 'exact' | 'percentage';

export interface Member {
  id: string;
  name: string;
  userID: string | null;
  email: string | null;
}

/** What the client sends in `PUT /groups/{id}/expenses/{id}`. */
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

/** The fields a user edits; everything else on an expense is bookkeeping. */
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
  /** UTC time of the last change on the server; decides whose edit is newest. */
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

/** `POST /groups`, including the optional fields used to upload a group that already exists on a phone. */
export interface GroupCreateInput {
  id: string;
  name: string;
  currencyCode: string;
  members: { id: string; name: string }[];
  meMemberID: string;
}
