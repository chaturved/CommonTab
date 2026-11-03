import { formatCurrency } from '../money/format';
import { formatMinorUnits, parseMinorUnits } from '../money/money';
import { allocate, splitEqual, type Allocation } from '../splitter';
import { commonScale, parseDecimal } from '../splitter/decimal';
import type { ExpenseDraft } from '../sync/actions';
import type { LocalExpense, LocalGroup } from '../storage/types';
import { displayName } from './groups';

export const CATEGORIES = [
  { id: 'dining', label: 'Dining' },
  { id: 'groceries', label: 'Groceries' },
  { id: 'travel', label: 'Travel' },
  { id: 'household', label: 'Household' },
  { id: 'transport', label: 'Transport' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'other', label: 'Other' },
] as const;

export const categoryLabel = (id: string): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? (id ? id[0]!.toUpperCase() + id.slice(1) : 'Other');

export type FormMethod = 'equal' | 'exact' | 'percent';

export interface ExpenseForm {
  merchant: string;
  amountText: string;
  payerID: string;
  date: string;
  category: string;
  notes: string;
  method: FormMethod;
  participants: string[];
  amounts: Record<string, string>;
  percents: Record<string, string>;
}

export interface SplitIssue {
  kind: 'short' | 'over' | 'percent' | 'invalid';
  diffMinor: number;
  percentTotal?: string;
}

export interface FormEvaluation {
  amountMinor: number | null;
  errors: { merchant?: string; amount?: string; participants?: string; date?: string };
  shares: Allocation[];
  split: SplitIssue | null;
  draft: ExpenseDraft | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDate(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newExpenseForm(group: LocalGroup, nowMs: number): ExpenseForm {
  return {
    merchant: '', amountText: '', payerID: group.meMemberID, date: localDate(nowMs), category: 'dining', notes: '',
    method: 'equal', participants: group.members.map((m) => m.id), amounts: {}, percents: {},
  };
}

export function formFromExpense(expense: LocalExpense, currencyCode: string): ExpenseForm {
  const participants = expense.allocations.map((a) => a.memberID);
  const method: FormMethod = expense.method === 'percentage' ? 'percent' : expense.method;
  const amounts: Record<string, string> = {};
  const percents: Record<string, string> = {};
  participants.forEach((id, i) => {
    if (method === 'exact') amounts[id] = formatMinorUnits(Number(expense.values[i] ?? 0), currencyCode);
    if (method === 'percent') percents[id] = expense.values[i] ?? '';
  });
  return {
    merchant: expense.merchant, amountText: formatMinorUnits(expense.amountMinor, currencyCode), payerID: expense.payerID,
    date: expense.occurredAt.slice(0, 10), category: expense.category, notes: expense.notes, method, participants, amounts, percents,
  };
}

const tryParse = (text: string, currencyCode: string): number | null => {
  try {
    return parseMinorUnits(text, currencyCode);
  } catch {
    return null;
  }
};

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().startsWith(date);

function percentTotal(values: readonly string[]): { total: bigint; scale: number; digits: bigint[] } | null {
  try {
    const { digits, scale } = commonScale(values.map((v) => parseDecimal(v, 'invalid_percentage')));
    return { total: digits.reduce((a, b) => a + b, 0n), scale, digits };
  } catch {
    return null;
  }
}

function showPercent(total: bigint, scale: number): string {
  const text = total.toString().padStart(scale + 1, '0');
  const whole = scale === 0 ? text : text.slice(0, -scale);
  const fraction = scale === 0 ? '' : text.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function evaluateForm(form: ExpenseForm, currencyCode: string): FormEvaluation {
  const errors: FormEvaluation['errors'] = {};
  if (form.merchant.trim() === '') errors.merchant = 'Add a description';
  const parsed = form.amountText.trim() === '' ? null : tryParse(form.amountText, currencyCode);
  const amountMinor = parsed !== null && parsed > 0 ? parsed : null;
  if (amountMinor === null) errors.amount = 'Enter an amount';
  if (form.participants.length === 0) errors.participants = 'Pick at least one person';
  if (!validDate(form.date)) errors.date = 'Use the format YYYY-MM-DD';

  let shares: Allocation[] = [];
  let split: SplitIssue | null = null;
  let values: string[] = [];

  if (form.participants.length > 0 && amountMinor !== null) {
    if (form.method === 'equal') {
      shares = allocate({ method: 'equal', amount: amountMinor, participants: form.participants });
    } else if (form.method === 'exact') {
      const minors = form.participants.map((id) => ((form.amounts[id] ?? '').trim() === '' ? 0 : tryParse(form.amounts[id] as string, currencyCode)));
      if (minors.some((m) => m === null)) {
        split = { kind: 'invalid', diffMinor: 0 };
      } else {
        const units = minors as number[];
        shares = form.participants.map((memberID, i) => ({ memberID, minorUnits: units[i] as number }));
        const sum = units.reduce((a, b) => a + b, 0);
        if (sum !== amountMinor) split = { kind: sum < amountMinor ? 'short' : 'over', diffMinor: Math.abs(amountMinor - sum) };
        values = units.map(String);
      }
    } else {
      const entered = form.participants.map((id) => (form.percents[id] ?? '').trim());
      const result = entered.every((v) => v !== '') ? percentTotal(entered) : null;
      if (!result) {
        split = { kind: 'invalid', diffMinor: 0 };
      } else if (result.total !== 100n * 10n ** BigInt(result.scale)) {
        split = { kind: 'percent', diffMinor: 0, percentTotal: showPercent(result.total, result.scale) };
      } else {
        shares = allocate({ method: 'percent', amount: amountMinor, participants: form.participants, values: entered });
        values = entered;
      }
    }
  }

  const ok = Object.keys(errors).length === 0 && split === null && amountMinor !== null;
  const draft: ExpenseDraft | null = ok
    ? {
        merchant: form.merchant.trim(), occurredAt: `${form.date}T12:00:00.000Z`, category: form.category, notes: form.notes.trim(),
        amountMinor, payerID: form.payerID, method: form.method === 'percent' ? 'percentage' : form.method, participants: form.participants, values,
      }
    : null;
  return { amountMinor, errors, shares, split, draft };
}

export function splitIssueMessage(issue: SplitIssue, currencyCode: string, amountMinor: number, shares: readonly Allocation[]): string {
  if (issue.kind === 'percent') return `Percentages add up to ${issue.percentTotal}%. They need to add up to 100%.`;
  if (issue.kind === 'invalid') return 'Fill in every share with a number.';
  const sum = shares.reduce((a, s) => a + s.minorUnits, 0);
  const diff = formatCurrency(issue.diffMinor, currencyCode);
  return issue.kind === 'short'
    ? `Amounts add up to ${formatCurrency(sum, currencyCode)}. ${diff} short of the total.`
    : `Amounts add up to ${formatCurrency(sum, currencyCode)}. ${diff} over the total of ${formatCurrency(amountMinor, currencyCode)}.`;
}

export function toggleParticipant(form: ExpenseForm, memberId: string, order: readonly string[]): ExpenseForm {
  const has = form.participants.includes(memberId);
  const participants = order.filter((id) => (id === memberId ? !has : form.participants.includes(id)));
  return { ...form, participants };
}

export function addDifferenceTo(form: ExpenseForm, memberId: string, currencyCode: string, issue: SplitIssue): ExpenseForm {
  if (form.method !== 'exact' || (issue.kind !== 'short' && issue.kind !== 'over')) return form;
  const current = tryParse(form.amounts[memberId] ?? '0', currencyCode) ?? 0;
  const next = issue.kind === 'short' ? current + issue.diffMinor : current - issue.diffMinor;
  if (next < 0) return form;
  return { ...form, amounts: { ...form.amounts, [memberId]: formatMinorUnits(next, currencyCode) } };
}

export function splitRestEqually(form: ExpenseForm, currencyCode: string, issue: SplitIssue): ExpenseForm {
  if (form.method !== 'exact' || issue.kind !== 'short' || form.participants.length === 0) return form;
  const extra = splitEqual(issue.diffMinor, form.participants.length);
  const amounts = { ...form.amounts };
  form.participants.forEach((id, i) => {
    amounts[id] = formatMinorUnits((tryParse(amounts[id] ?? '0', currencyCode) ?? 0) + (extra[i] as number), currencyCode);
  });
  return { ...form, amounts };
}

const hundredths = (n: number): string => `${Math.floor(n / 100)}.${pad(n % 100)}`;

export function evenPercents(form: ExpenseForm): ExpenseForm {
  const parts = splitEqual(10000, Math.max(1, form.participants.length));
  const percents = { ...form.percents };
  form.participants.forEach((id, i) => {
    percents[id] = hundredths(parts[i] as number);
  });
  return { ...form, percents };
}

export function switchMethod(form: ExpenseForm, method: FormMethod, currencyCode: string): ExpenseForm {
  if (method === form.method) return form;
  const next: ExpenseForm = { ...form, method };
  const evaluated = evaluateForm({ ...form, method: 'equal' }, currencyCode);
  if (method === 'exact' && evaluated.shares.length > 0) {
    next.amounts = Object.fromEntries(evaluated.shares.map((s) => [s.memberID, formatMinorUnits(s.minorUnits, currencyCode)]));
  }
  if (method === 'percent') return evenPercents(next);
  return next;
}

export interface BalanceChange {
  memberID: string;
  name: string;
  deltaMinor: number;
}

interface Shape {
  payerID: string;
  amountMinor: number;
  allocations: readonly Allocation[];
}

function nets(members: readonly string[], shape: Shape | null): Map<string, number> {
  const net = new Map(members.map((id) => [id, 0]));
  if (!shape) return net;
  net.set(shape.payerID, (net.get(shape.payerID) ?? 0) + shape.amountMinor);
  for (const a of shape.allocations) net.set(a.memberID, (net.get(a.memberID) ?? 0) - a.minorUnits);
  return net;
}

export function balanceChanges(group: LocalGroup, before: Shape | null, after: Shape | null): BalanceChange[] {
  const ids = group.members.map((m) => m.id);
  const was = nets(ids, before);
  const now = nets(ids, after);
  return group.members
    .map((m) => ({ memberID: m.id, name: displayName(m, group.meMemberID), deltaMinor: (now.get(m.id) ?? 0) - (was.get(m.id) ?? 0) }))
    .filter((c) => c.deltaMinor !== 0);
}

export function balanceChangeNote(changes: readonly BalanceChange[], meMemberID: string, currencyCode: string): string | null {
  const others = changes.filter((c) => c.memberID !== meMemberID);
  if (others.length === 0) return null;
  const names = others.length === 1 ? others[0]!.name : `${others.slice(0, -1).map((c) => c.name).join(', ')} and ${others[others.length - 1]!.name}`;
  const amounts = new Set(others.map((c) => Math.abs(c.deltaMinor)));
  if (amounts.size === 1) return `Balances for ${names} will change by ${formatCurrency([...amounts][0]!, currencyCode)}${others.length > 1 ? ' each' : ''}.`;
  return `Balances for ${names} will change.`;
}

