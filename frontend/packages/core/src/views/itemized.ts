import { CoreError } from '../errors';
import { formatMinorUnits, parseMinorUnits } from '../money/money';
import { splitByItem, type ItemizedResult } from '../splitter';
import type { ExpenseForm } from './expenseForm';

export interface ItemRow {
  name: string;
  priceText: string;
  assignedTo: string[];
}

export interface ItemizedInput {
  people: string[];
  items: ItemRow[];
  taxText: string;
  tipPercent: string;
}

export type ItemizedEvaluation = { ok: true; result: ItemizedResult } | { ok: false; message: string };

export function evaluateItemized(input: ItemizedInput, currencyCode: string): ItemizedEvaluation {
  const filled = input.items.filter((i) => i.name.trim() !== '' || i.priceText.trim() !== '');
  if (filled.length === 0) return { ok: false, message: 'Add at least one item.' };
  try {
    const items = filled.map((i) => {
      if (i.name.trim() === '') throw new CoreError('invalid_bill', 'Give every item a name.');
      const priceCents = parseMinorUnits(i.priceText, currencyCode);
      if (priceCents === 0) throw new CoreError('invalid_bill', `${i.name.trim()} needs a price.`);
      if (i.assignedTo.length === 0) throw new CoreError('invalid_bill', `Pick who had ${i.name.trim()}.`);
      return { name: i.name.trim(), priceCents, assignedTo: i.assignedTo };
    });
    const taxCents = input.taxText.trim() === '' ? 0 : parseMinorUnits(input.taxText, currencyCode);
    const tipPercent = input.tipPercent.trim() === '' ? '0' : input.tipPercent.trim();
    return { ok: true, result: splitByItem({ people: input.people, items, taxCents, tipPercent }) };
  } catch (error) {
    if (error instanceof CoreError) {
      return { ok: false, message: /amount|price|tax/i.test(error.message) && error.code === 'invalid_amount' ? 'Check the prices. Use numbers like 12.50.' : error.message };
    }
    throw error;
  }
}

export function applyItemized(form: ExpenseForm, result: ItemizedResult, currencyCode: string): ExpenseForm {
  const payers = result.shares.filter((s) => s.total > 0);
  const amounts = Object.fromEntries(payers.map((s) => [s.personID, formatMinorUnits(s.total, currencyCode)]));
  return { ...form, method: 'exact', amountText: formatMinorUnits(result.total, currencyCode), participants: payers.map((s) => s.personID), amounts };
}
