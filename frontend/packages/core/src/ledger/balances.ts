import { CoreError } from '../errors';
import { assertMinorUnits, isMinorUnits, sumMinorUnits } from '../money';
import type { Allocation } from '../splitter';

export interface LedgerExpense {
  id: string;
  amount: number;
  payerID: string;
  allocations: readonly Allocation[];
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
  minorUnits: number;
}

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
