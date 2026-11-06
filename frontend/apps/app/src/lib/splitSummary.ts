import { formatCurrency, splitIssueMessage, type ExpenseForm, type FormEvaluation } from '@commontab/core';

export function splitMethodLabel(form: ExpenseForm, byItem: boolean): string {
  if (byItem) return 'By item';
  return form.method === 'equal' ? 'Equally' : form.method === 'exact' ? 'Exact amounts' : 'By percent';
}

export function splitSummary(form: ExpenseForm, evaluated: FormEvaluation, byItem: boolean, currency: string): string {
  const method = splitMethodLabel(form, byItem);
  const first = evaluated.shares[0];
  if (form.method === 'equal' && !byItem && first && evaluated.amountMinor !== null) return `${method} · ${formatCurrency(first.minorUnits, currency)} each`;
  const count = form.participants.length;
  return `${method} · ${count === 1 ? '1 person' : `${count} people`}`;
}

export function splitProblem(form: ExpenseForm, evaluated: FormEvaluation, byItem: boolean, currency: string): string | null {
  if (byItem || form.method === 'equal' || !evaluated.split) return null;
  if (evaluated.amountMinor === null && form.method !== 'percent') return null;
  return splitIssueMessage(evaluated.split, currency, evaluated.amountMinor ?? 0, evaluated.shares);
}
