import { CoreError } from '../errors';
import type { Balance } from './balances';

export interface Transfer {
  fromID: string;
  toID: string;
  minorUnits: number;
}

export function simplifyDebts(balances: readonly Balance[]): Transfer[] {
  if (balances.reduce((sum, b) => sum + b.minorUnits, 0) !== 0 || balances.some((b) => !Number.isSafeInteger(b.minorUnits))) {
    throw new CoreError('invalid_ledger', 'Balances must add up to zero');
  }
  const byAmountThenOrder = (sign: 1 | -1) =>
    balances
      .map((b, order) => ({ id: b.memberID, left: b.minorUnits * sign, order }))
      .filter((p) => p.left > 0)
      .sort((a, b) => b.left - a.left || a.order - b.order);

  const debtors = byAmountThenOrder(-1);
  const creditors = byAmountThenOrder(1);
  const transfers: Transfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const minorUnits = Math.min(debtor.left, creditor.left);
    transfers.push({ fromID: debtor.id, toID: creditor.id, minorUnits });
    debtor.left -= minorUnits;
    creditor.left -= minorUnits;
    if (debtor.left === 0) debtors.shift();
    if (creditor.left === 0) creditors.shift();
    debtors.sort((a, b) => b.left - a.left || a.order - b.order);
    creditors.sort((a, b) => b.left - a.left || a.order - b.order);
  }
  return transfers;
}
