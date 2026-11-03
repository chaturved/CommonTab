import { CoreError } from '../errors';
import { splitEqual } from '../splitter';
import { parseDecimal } from '../splitter/decimal';

export interface TipSplit {
  billMinor: number;
  tipMinor: number;
  totalMinor: number;
  shares: number[];
}

export function tipSplit(input: { billMinor: number; tipPercent: string; people: number }): TipSplit {
  const { billMinor, people } = input;
  if (!Number.isSafeInteger(billMinor) || billMinor < 0) throw new CoreError('invalid_bill', 'Invalid bill');
  if (!Number.isInteger(people) || people < 1 || people > 20) throw new CoreError('invalid_bill', 'A bill needs 1 to 20 people');
  const percent = parseDecimal(input.tipPercent, 'invalid_bill');
  const denominator = 100n * 10n ** BigInt(percent.scale);
  if (percent.digits > denominator) throw new CoreError('invalid_bill', 'Tip must be 0 to 100 percent');
  const tipMinor = Number((2n * BigInt(billMinor) * percent.digits + denominator) / (2n * denominator));
  const totalMinor = billMinor + tipMinor;
  return { billMinor, tipMinor, totalMinor, shares: splitEqual(totalMinor, people) };
}
