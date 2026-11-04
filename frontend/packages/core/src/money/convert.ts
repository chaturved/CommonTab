import { CoreError } from '../errors';
import { digitsFor } from './money';

export const RATE_SCALE = 1_000_000;

export function convertMinorUnits(original: number, from: string, to: string, rateMicros: number): number {
  const numerator = BigInt(original) * BigInt(rateMicros) * 10n ** BigInt(digitsFor(to));
  const denominator = BigInt(RATE_SCALE) * 10n ** BigInt(digitsFor(from));
  const converted = (2n * numerator + denominator) / (2n * denominator);
  if (converted < 1n) throw new CoreError('invalid_amount', 'The amount is too small to convert');
  return Number(converted);
}
