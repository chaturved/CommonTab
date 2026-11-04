import type { Api } from '../api/types';
import type { Storage } from '../storage/types';

export interface RateResult {
  rateMicros: number;
  date: string;
  fresh: boolean;
}

const key = (base: string, quote: string) => `rate:${base}:${quote}`;

export async function quoteRate(api: Pick<Api, 'rate'>, storage: Pick<Storage, 'getMeta' | 'setMeta'>, base: string, quote: string): Promise<RateResult | null> {
  try {
    const quoted = await api.rate(base, quote);
    await storage.setMeta(key(base, quote), JSON.stringify({ rateMicros: quoted.rateMicros, date: quoted.date }));
    return { rateMicros: quoted.rateMicros, date: quoted.date, fresh: true };
  } catch {
    return savedRate(storage, base, quote);
  }
}

export async function savedRate(storage: Pick<Storage, 'getMeta'>, base: string, quote: string): Promise<RateResult | null> {
  const saved = await storage.getMeta(key(base, quote));
  if (!saved) return null;
  try {
    const { rateMicros, date } = JSON.parse(saved) as { rateMicros: number; date: string };
    return Number.isSafeInteger(rateMicros) && rateMicros > 0 && typeof date === 'string' ? { rateMicros, date, fresh: false } : null;
  } catch {
    return null;
  }
}
