import { CoreError } from '../errors';
import type { Balance } from './balances';

export interface Transfer {
  fromID: string;
  toID: string;
  minorUnits: number;
}

/**
 * Settle everyone with few payments. Greedy: the member who owes the most pays the member
 * who is owed the most, as much as covers one of them, and repeat. Ties go to the member
 * listed first. Results are deterministic, so every device shows the same payments.
 * This is not guaranteed to be the true minimum (that is NP-hard in general); it never
 * needs more than (people with a balance - 1) payments. Everyone ends with the same net balance.
 */
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
    // Re-sort only the party that still has a balance; the other is done.
    if (debtor.left === 0) debtors.shift();
    if (creditor.left === 0) creditors.shift();
    debtors.sort((a, b) => b.left - a.left || a.order - b.order);
    creditors.sort((a, b) => b.left - a.left || a.order - b.order);
  }
  return transfers;
}
