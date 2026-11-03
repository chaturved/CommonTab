import { CoreError } from '../errors';
import { assertMinorUnits, isMinorUnits, sumMinorUnits } from '../money';
import type { Allocation } from '../splitter';

export interface LedgerExpense {
  id: string;
  /** Total in minor units. */
  amount: number;
  payerID: string;
  /** Who owes what; must add up to `amount`. */
  allocations: readonly Allocation[];
  /** Set on a tombstone. Deleted expenses never count towards balances. */
  deletedAt?: string | null;
}

export interface LedgerSettlement {
  id: string;
  fromID: string;
  toID: string;
  minorUnits: number;
}

export interface LedgerInput {
  members: readonly string[];
  expenses: readonly LedgerExpense[];
  settlements: readonly LedgerSettlement[];
}

export interface Balance {
  memberID: string;
  /** Positive: the member is owed money. Negative: the member owes money. */
  minorUnits: number;
}

/**
 * Net balance per member, in member order: paid minus owed, plus settlements sent,
 * minus settlements received. Always recomputed from the records, never stored.
 * The balances of a group sum to zero.
 */
export function computeBalances({ members, expenses, settlements }: LedgerInput): Balance[] {
  const net = new Map<string, number>(members.map((id) => [id, 0]));
  if (net.size !== members.length) throw new CoreError('invalid_ledger', 'Duplicate member');
  const add = (id: string, delta: number) => net.set(id, (net.get(id) as number) + delta);

  for (const expense of expenses) {
    if (expense.deletedAt) continue;
    assertMinorUnits(expense.amount);
    const ids = expense.allocations.map((a) => a.memberID);
    if (
      !net.has(expense.payerID) ||
      ids.length === 0 ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => net.has(id)) ||
      !expense.allocations.every((a) => isMinorUnits(a.minorUnits)) ||
      sumMinorUnits(expense.allocations.map((a) => a.minorUnits)) !== expense.amount
    ) {
      throw new CoreError('invalid_allocation', `Expense ${expense.id} does not add up`);
    }
    add(expense.payerID, expense.amount);
    for (const { memberID, minorUnits } of expense.allocations) add(memberID, -minorUnits);
  }

  for (const s of settlements) {
    if (s.fromID === s.toID || !net.has(s.fromID) || !net.has(s.toID) || !isMinorUnits(s.minorUnits) || s.minorUnits === 0) {
      throw new CoreError('invalid_settlement', `Settlement ${s.id} is invalid`);
    }
    add(s.fromID, s.minorUnits);
    add(s.toID, -s.minorUnits);
  }

  return members.map((memberID) => ({ memberID, minorUnits: net.get(memberID) as number }));
}
