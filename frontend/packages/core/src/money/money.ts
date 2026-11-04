import { CoreError } from '../errors';
import { fractionDigits } from './currency';

export const MAX_MAJOR_UNITS = 1_000_000_000;

export function digitsFor(currencyCode: string): number {
  const digits = fractionDigits(currencyCode);
  if (digits === undefined) throw new CoreError('invalid_currency', `Unknown currency ${currencyCode}`);
  return digits;
}

export function isMinorUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function assertMinorUnits(value: unknown, message = 'Amount must be whole minor units'): asserts value is number {
  if (!isMinorUnits(value)) throw new CoreError('invalid_amount', message);
}

export function parseMinorUnits(text: string, currencyCode: string): number {
  const digits = digitsFor(currencyCode);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new CoreError('invalid_amount', `Not an amount: ${text}`);
  const whole = match[1] as string;
  const fraction = match[2] ?? '';
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) {
    throw new CoreError('invalid_amount', `Too many decimal places for ${currencyCode}`);
  }
  const padded = fraction.slice(0, digits).padEnd(digits, '0');
  const units = BigInt(whole + padded);
  if (units > BigInt(MAX_MAJOR_UNITS) * 10n ** BigInt(digits)) {
    throw new CoreError('invalid_amount', 'Amount is too large');
  }
  return Number(units);
}

export function formatMinorUnits(units: number, currencyCode: string): string {
  assertMinorUnits(units);
  const digits = digitsFor(currencyCode);
  if (digits === 0) return String(units);
  const text = String(units).padStart(digits + 1, '0');
  return `${text.slice(0, -digits)}.${text.slice(-digits)}`;
}

export function sumMinorUnits(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) throw new CoreError('invalid_amount', 'Amount overflow');
  }
  return total;
}

export function allocateProportionally(amount: bigint, weights: readonly bigint[]): bigint[] {
  const total = weights.reduce((a, b) => a + b, 0n);
  if (amount < 0n || weights.some((w) => w < 0n) || total <= 0n) {
    throw new CoreError('invalid_allocation', 'Cannot allocate');
  }
  const shares = weights.map((w) => (amount * w) / total);
  const remainders = weights.map((w) => (amount * w) % total);
  let left = Number(amount - shares.reduce((a, b) => a + b, 0n));
  const order = weights.map((_, i) => i).sort((i, j) => {
    const a = remainders[i] as bigint;
    const b = remainders[j] as bigint;
    return a === b ? i - j : a > b ? -1 : 1;
  });
  for (const index of order) {
    if (left <= 0) break;
    shares[index] = (shares[index] as bigint) + 1n;
    left -= 1;
  }
  return shares;
}
