import type { Store } from '../storage/types';
import type { Clock, Random } from '../types';
import { backoffDelay } from './backoff';
import type { OutboxEntry, OutboxPayload } from './types';

export interface OutboxContext {
  clock: Clock;
  random: Random;
}

export interface Change {
  groupId: string;
  entityId: string;
  payload: OutboxPayload;
  /** Server version this change builds on; null for a record that never synced. */
  baseVersion: number | null;
}

/** Entries for the same record are coalesced: the key is the record, not the kind of change. */
export function entityKey(entry: Pick<OutboxEntry, 'kind' | 'entityId'>): string {
  return `${entry.kind.split('.')[0]}:${entry.entityId}`;
}

/**
 * Add a change to the queue inside the caller's transaction.
 * - edit then edit: one PUT with the latest content, built on the first edit's base version;
 * - delete after edit: the PUT is dropped, and if the record never synced nothing is sent at all;
 * - a settlement is append-only, so a second entry for the same id is the same payment and is ignored.
 * Returns the queued entry, or null when the change cancelled out.
 */
export async function enqueue(tx: Store, ctx: OutboxContext, change: Change): Promise<OutboxEntry | null> {
  const now = ctx.clock.now();
  const entries = await tx.listOutbox();
  const probe = { kind: change.payload.kind, entityId: change.entityId };
  const existing = entries.find((e) => entityKey(e) === entityKey(probe));
  const fresh: OutboxEntry = {
    opId: ctx.random.uuid(),
    seq: 1 + Math.max(0, ...entries.map((e) => e.seq)),
    kind: change.payload.kind,
    groupId: change.groupId,
    entityId: change.entityId,
    payload: change.payload,
    baseVersion: change.baseVersion,
    createdAt: now,
    editedAt: now,
    lastAttemptAt: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    status: 'ready',
  };
  if (!existing) {
    await tx.putOutbox(fresh);
    return fresh;
  }
  if (existing.kind === 'settlement.create') return existing;
  if (existing.kind === 'expense.delete') {
    if (change.payload.kind === 'expense.delete') return existing;
    throw new Error('Cannot edit an expense that is being deleted');
  }
  if (existing.kind === 'expense.put' && change.payload.kind === 'expense.delete' && existing.baseVersion === null && existing.lastAttemptAt === null) {
    await tx.deleteOutbox(existing.opId);
    return null;
  }
  // Same record again: keep its place in the queue and the version it was first built on.
  const merged: OutboxEntry = { ...fresh, seq: existing.seq, createdAt: existing.createdAt, baseVersion: existing.baseVersion };
  await tx.deleteOutbox(existing.opId);
  await tx.putOutbox(merged);
  return merged;
}

/** The entry to send next for a group, or why nothing can be sent yet. */
export function nextForGroup(entries: readonly OutboxEntry[], groupId: string, now: number): { entry?: OutboxEntry; waitMs?: number } {
  const head = entries.filter((e) => e.groupId === groupId && e.status === 'ready').sort((a, b) => a.seq - b.seq)[0];
  if (!head) return {};
  // A backing-off entry holds back the ones after it, so order within a group is kept.
  return head.nextAttemptAt > now ? { waitMs: head.nextAttemptAt - now } : { entry: head };
}

/** When the app should next wake the engine (earliest retry across groups), or null if nothing waits. */
export function nextRetryAt(entries: readonly OutboxEntry[]): number | null {
  const groups = new Set(entries.filter((e) => e.status === 'ready').map((e) => e.groupId));
  const times = [...groups].map((g) => entries.filter((e) => e.groupId === g && e.status === 'ready').sort((a, b) => a.seq - b.seq)[0]!.nextAttemptAt);
  return times.length ? Math.min(...times) : null;
}

/** Record a failed attempt and schedule the retry. `retryAfterMs` (from a 429) can only lengthen the wait. */
export function afterFailure(entry: OutboxEntry, ctx: OutboxContext, message: string, retryAfterMs = 0): OutboxEntry {
  const attempts = entry.attempts + 1;
  const wait = Math.max(backoffDelay(attempts, ctx.random.next()), retryAfterMs);
  return { ...entry, attempts, lastError: message, nextAttemptAt: ctx.clock.now() + wait };
}
