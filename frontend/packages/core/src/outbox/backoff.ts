export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_CAP_MS = 5 * 60_000;
/** Jitter spreads retries by up to +/-20% so devices that went offline together don't retry together. */
export const BACKOFF_JITTER = 0.2;

/** Delay before retry number `attempts` (1 = the first failure): 2s, 4s, 8s ... capped at 5 minutes. */
export function backoffDelay(attempts: number, random: number): number {
  const exponent = Math.min(Math.max(attempts, 1) - 1, 20);
  const base = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
  const jitter = 1 - BACKOFF_JITTER + 2 * BACKOFF_JITTER * random;
  return Math.min(Math.round(base * jitter), BACKOFF_CAP_MS);
}
