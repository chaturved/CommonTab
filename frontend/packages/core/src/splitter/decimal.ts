import { CoreError, CoreErrorCode } from '../errors';

export interface Decimal {
  digits: bigint;
  scale: number;
}

export function parseDecimal(text: string, code: CoreErrorCode = 'invalid_amount'): Decimal {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new CoreError(code, `Not a non-negative decimal: ${text}`);
  const fraction = match[2] ?? '';
  return { digits: BigInt((match[1] as string) + fraction), scale: fraction.length };
}

export function commonScale(values: readonly Decimal[]): { digits: bigint[]; scale: number } {
  const scale = Math.max(0, ...values.map((v) => v.scale));
  return { digits: values.map((v) => v.digits * 10n ** BigInt(scale - v.scale)), scale };
}
