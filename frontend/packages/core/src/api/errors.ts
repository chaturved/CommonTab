import type { WireExpense } from '../types';

/**
 * A failed call. `status` 0 means the request never got an answer (no network, timeout, DNS).
 * 429 and 5xx are retried like a network failure; 401, 404, 409 and 422 mean something specific.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    readonly extra: { current?: WireExpense; maxAmountMinor?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean { return this.status === 0; }
  get isRetryable(): boolean { return this.status === 0 || this.status === 429 || this.status >= 500; }
  get current(): WireExpense | undefined { return this.extra.current; }
  get maxAmountMinor(): number | undefined { return this.extra.maxAmountMinor; }
  get retryAfterMs(): number { return (this.extra.retryAfterSeconds ?? 0) * 1000; }
}
