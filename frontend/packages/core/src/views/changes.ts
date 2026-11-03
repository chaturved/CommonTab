import { formatCurrency } from '../money/format';
import type { LocalContent, LocalGroup } from '../storage/types';
import type { WireExpense } from '../types';
import { categoryLabel } from './expenseForm';
import { longDate } from './dates';
import { displayName } from './groups';

export interface FieldChange {
  field: 'description' | 'amount' | 'paidBy' | 'date' | 'category' | 'split';
  label: string;
  mine: string;
  theirs: string;
}

type Side = Pick<WireExpense, 'merchant' | 'amountMinor' | 'payerID' | 'occurredAt' | 'category' | 'method' | 'allocations'>;

const splitText = (side: Side, group: LocalGroup): string => {
  const names = side.allocations.map((a) => {
    const member = group.members.find((m) => m.id === a.memberID);
    return `${member ? displayName(member, group.meMemberID) : 'Someone'} ${formatCurrency(a.minorUnits, group.currencyCode)}`;
  });
  return `${side.method === 'equal' ? 'Equally' : side.method === 'exact' ? 'By amount' : 'By percent'}: ${names.join(', ')}`;
};

export function expenseChanges(mine: LocalContent, theirs: Side, group: LocalGroup): FieldChange[] {
  const name = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };
  const candidates: FieldChange[] = [
    { field: 'description', label: 'Description', mine: mine.merchant, theirs: theirs.merchant },
    { field: 'amount', label: 'Amount', mine: formatCurrency(mine.amountMinor, group.currencyCode), theirs: formatCurrency(theirs.amountMinor, group.currencyCode) },
    { field: 'paidBy', label: 'Paid by', mine: name(mine.payerID), theirs: name(theirs.payerID) },
    { field: 'date', label: 'Date', mine: longDate(mine.occurredAt), theirs: longDate(theirs.occurredAt) },
    { field: 'category', label: 'Category', mine: categoryLabel(mine.category), theirs: categoryLabel(theirs.category) },
    { field: 'split', label: 'Split', mine: splitText(mine, group), theirs: splitText(theirs, group) },
  ];
  return candidates.filter((c) => c.mine !== c.theirs);
}
