import { formatCurrency } from '../money/format';
import type { LocalExpense, LocalGroup } from '../storage/types';
import { shortDate } from './dates';
import { displayName } from './groups';

export interface ExpensePosition {
  kind: 'lent' | 'owe' | 'none';
  minorUnits: number;
}

export function positionIn(expense: Pick<LocalExpense, 'payerID' | 'amountMinor' | 'allocations'>, meMemberID: string): ExpensePosition {
  const share = expense.allocations.find((a) => a.memberID === meMemberID)?.minorUnits ?? 0;
  if (expense.payerID === meMemberID) {
    const lent = expense.amountMinor - share;
    return lent > 0 ? { kind: 'lent', minorUnits: lent } : { kind: 'none', minorUnits: 0 };
  }
  return share > 0 ? { kind: 'owe', minorUnits: share } : { kind: 'none', minorUnits: 0 };
}

export const positionWords = (kind: ExpensePosition['kind']): string => (kind === 'lent' ? 'you lent' : kind === 'owe' ? 'you owe' : 'not involved');

export interface ExpenseRowModel {
  id: string;
  merchant: string;
  position: ExpensePosition;
  words: string;
  paidBy: string;
  groupSubtitle: string;
  homeSubtitle: string;
  pendingLabel: string | null;
  syncState: LocalExpense['syncState'];
  occurredAt: string;
}

export function expenseRow(expense: LocalExpense, group: LocalGroup): ExpenseRowModel {
  const payer = group.members.find((m) => m.id === expense.payerID);
  const paidBy = payer ? displayName(payer, group.meMemberID) : 'Someone';
  const youPaid = expense.payerID === group.meMemberID;
  const date = shortDate(expense.occurredAt);
  const position = positionIn(expense, group.meMemberID);
  const pending = expense.syncState === 'pending' || expense.syncState === 'failed';
  return {
    id: expense.id,
    merchant: expense.merchant,
    position,
    words: positionWords(position.kind),
    paidBy,
    groupSubtitle: `${youPaid ? 'You paid' : `${paidBy} paid`} ${formatCurrency(expense.amountMinor, group.currencyCode)} · ${date}`,
    homeSubtitle: `${group.name} · ${youPaid ? 'You paid' : `Paid by ${paidBy}`} · ${date}`,
    pendingLabel: pending ? `${expense.version === 0 ? 'New' : 'Edited'} · waiting to sync` : null,
    syncState: expense.syncState,
    occurredAt: expense.occurredAt,
  };
}

export const byNewest = (a: { occurredAt: string }, b: { occurredAt: string }): number => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0);
