import { CoreError } from '../errors';
import { allocateProportionally, assertMinorUnits, MAX_MAJOR_UNITS, sumMinorUnits } from '../money';
import { parseDecimal } from './decimal';
import { MAX_PARTICIPANTS, splitEqual } from './splitter';

export interface BillItem {
  name: string;
  priceCents: number;
  assignedTo: readonly string[];
}

export interface ItemizedBill {
  people: readonly string[];
  items: readonly BillItem[];
  taxCents: number;
  tipPercent: string;
}

export interface ItemizedShare {
  personID: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export interface ItemizedResult {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  shares: ItemizedShare[];
}

const MAX_ITEMS = 100;
const MAX_UNITS = MAX_MAJOR_UNITS * 1000;

export function splitByItem(bill: ItemizedBill): ItemizedResult {
  const { people, items } = bill;
  if (people.length === 0 || people.length > MAX_PARTICIPANTS || new Set(people).size !== people.length) {
    throw new CoreError('invalid_bill', 'A bill needs 1 to 20 distinct people');
  }
  if (items.length === 0 || items.length > MAX_ITEMS) throw new CoreError('invalid_bill', 'A bill needs 1 to 100 items');
  assertMinorUnits(bill.taxCents, 'Invalid tax');
  if (bill.taxCents > MAX_UNITS) throw new CoreError('invalid_bill', 'Invalid tax');
  const tipPercent = parseDecimal(bill.tipPercent, 'invalid_bill');
  const tipDenominator = 100n * 10n ** BigInt(tipPercent.scale);
  if (tipPercent.digits > tipDenominator) throw new CoreError('invalid_bill', 'Tip must be 0 to 100 percent');

  const subtotals = people.map(() => 0);
  for (const item of items) {
    assertMinorUnits(item.priceCents, 'Invalid item price');
    if (item.priceCents > MAX_UNITS) throw new CoreError('invalid_bill', 'Invalid item price');
    if (item.name.trim() === '') throw new CoreError('invalid_bill', 'Items need a name');
    if (item.assignedTo.length === 0) throw new CoreError('invalid_bill', `Nobody is assigned to ${item.name}`);
    const assigned = new Set(item.assignedTo);
    if (![...assigned].every((id) => people.includes(id))) throw new CoreError('invalid_bill', 'Item assigned to someone not on the bill');
    const indices = people.flatMap((id, index) => (assigned.has(id) ? [index] : []));
    const parts = splitEqual(item.priceCents, indices.length);
    indices.forEach((personIndex, position) => {
      subtotals[personIndex] = (subtotals[personIndex] as number) + (parts[position] as number);
    });
  }

  const subtotal = sumMinorUnits(subtotals);
  const tip = Number((2n * BigInt(subtotal) * tipPercent.digits + tipDenominator) / (2n * tipDenominator));
  const taxShares = shareProportionally(bill.taxCents, subtotals);
  const tipShares = shareProportionally(tip, subtotals);
  const shares = people.map((personID, index) => {
    const own = subtotals[index] as number;
    const tax = taxShares[index] as number;
    const tipShare = tipShares[index] as number;
    return { personID, subtotal: own, tax, tip: tipShare, total: own + tax + tipShare };
  });
  return { subtotal, tax: bill.taxCents, tip, total: subtotal + bill.taxCents + tip, shares };
}

function shareProportionally(amount: number, weights: readonly number[]): number[] {
  if (amount === 0) return weights.map(() => 0);
  if (weights.every((w) => w === 0)) return splitEqual(amount, weights.length);
  return allocateProportionally(BigInt(amount), weights.map(BigInt)).map(Number);
}
