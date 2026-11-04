import { RATE_SCALE } from './convert';

export function parseRate(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!match) return null;
  const micros = Number(BigInt(match[1] as string) * BigInt(RATE_SCALE) + BigInt((match[2] ?? '').padEnd(6, '0')));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

export function formatRate(rateMicros: number): string {
  const whole = Math.floor(rateMicros / RATE_SCALE);
  const fraction = String(rateMicros % RATE_SCALE).padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${fraction}`;
}

export const rateSentence = (from: string, to: string, rateMicros: number): string => `1 ${from} = ${formatRate(rateMicros)} ${to}`;
