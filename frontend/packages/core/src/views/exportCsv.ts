import { formatMinorUnits } from '../money/money';
import type { LocalExpense, LocalGroup, LocalSettlement } from '../storage/types';
import { displayName } from './groups';

const COLUMNS = ['Group', 'Type', 'Date', 'Description', 'Category', 'Paid by', 'Paid to', 'Amount', 'Currency', 'Your share', 'Notes'] as const;

export interface ExportGroup {
  group: LocalGroup;
  expenses: readonly LocalExpense[];
  settlements: readonly LocalSettlement[];
}

const cell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function expensesToCsv(groups: readonly ExportGroup[]): string {
  const lines: string[] = [COLUMNS.join(',')];
  for (const { group, expenses, settlements } of groups) {
    const nameOf = (id: string) => {
      const member = group.members.find((m) => m.id === id);
      return member ? displayName(member, group.meMemberID) : 'Someone';
    };
    const sorted = [...expenses].filter((e) => !e.deletedAt).sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
    for (const e of sorted) {
      const share = e.allocations.find((a) => a.memberID === group.meMemberID)?.minorUnits ?? 0;
      lines.push([
        group.name, 'Expense', e.occurredAt.slice(0, 10), e.merchant, e.category, nameOf(e.payerID), '',
        formatMinorUnits(e.amountMinor, group.currencyCode), group.currencyCode, formatMinorUnits(share, group.currencyCode), e.notes,
      ].map(cell).join(','));
    }
    for (const s of [...settlements].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
      lines.push([
        group.name, 'Payment', s.createdAt.slice(0, 10), '', '', nameOf(s.fromID), nameOf(s.toID),
        formatMinorUnits(s.amountMinor, group.currencyCode), group.currencyCode, '', '',
      ].map(cell).join(','));
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}
