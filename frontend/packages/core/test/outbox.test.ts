import { afterFailure, backoffDelay, BACKOFF_CAP_MS, enqueue, MemoryStorage, nextForGroup, nextRetryAt, type OutboxPayload } from '../src';
import { TestClock, TestRandom } from './support';

const put = (id: string, merchant = 'A'): OutboxPayload => ({
  kind: 'expense.put',
  expense: { id, merchant, occurredAt: '2026-10-01T10:00:00Z', category: 'x', notes: '', amountMinor: 100, payerID: 'p', method: 'equal', participants: ['p'], values: [], version: null },
});

function setup() {
  const storage = new MemoryStorage();
  const clock = new TestClock();
  const ctx = { clock, random: new TestRandom() };
  const add = (groupId: string, entityId: string, payload: OutboxPayload, baseVersion: number | null = null) =>
    storage.transaction((tx) => enqueue(tx, ctx, { groupId, entityId, payload, baseVersion }));
  return { storage, clock, ctx, add };
}

describe('backoff', () => {
  test('doubles from 2 seconds and caps at 5 minutes', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 8, 9, 30].map((n) => backoffDelay(n, 0.5));
    expect(delays).toEqual([2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, BACKOFF_CAP_MS, BACKOFF_CAP_MS]);
  });

  test('jitter stays within 20% and never passes the cap', () => {
    expect(backoffDelay(3, 0)).toBe(6400);
    expect(backoffDelay(3, 0.999)).toBe(9597);
    expect(backoffDelay(20, 0.999)).toBe(BACKOFF_CAP_MS);
  });

  test('afterFailure schedules the retry and a longer Retry-After wins', () => {
    const { clock, ctx } = setup();
    const entry = { opId: 'o', seq: 1, kind: 'expense.put', groupId: 'g', entityId: 'e', payload: put('e'), baseVersion: null, createdAt: 0, editedAt: 0, lastAttemptAt: null, attempts: 0, lastError: null, nextAttemptAt: 0, status: 'ready' } as const;
    const first = afterFailure(entry, ctx, 'offline');
    expect(first).toMatchObject({ attempts: 1, nextAttemptAt: clock.now() + 2000, lastError: 'offline' });
    expect(afterFailure(first, ctx, 'offline').nextAttemptAt).toBe(clock.now() + 4000);
    expect(afterFailure(entry, ctx, 'slow down', 30_000).nextAttemptAt).toBe(clock.now() + 30_000);
  });
});

describe('coalescing', () => {
  test('edit then edit sends one PUT with the latest content and the first base version', async () => {
    const { storage, add } = setup();
    await add('g', 'e1', put('e1', 'first'), 3);
    await add('g', 'e1', put('e1', 'second'), 4);
    const [only, ...rest] = await storage.listOutbox();
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ baseVersion: 3, seq: 1, payload: { expense: { merchant: 'second' } } });
  });

  test('an edit gets a new opId so a response for the old one is recognisable', async () => {
    const { storage, add } = setup();
    const first = await add('g', 'e1', put('e1'));
    const second = await add('g', 'e1', put('e1', 'B'));
    expect(second!.opId).not.toBe(first!.opId);
    expect(await storage.listOutbox()).toHaveLength(1);
  });

  test('keeps its place in the queue when edited again', async () => {
    const { storage, add } = setup();
    await add('g', 'e1', put('e1'));
    await add('g', 'e2', put('e2'));
    await add('g', 'e1', put('e1', 'B'));
    expect((await storage.listOutbox()).map((e) => e.entityId)).toEqual(['e1', 'e2']);
  });

  test('deleting an expense that never left the phone cancels both and sends nothing', async () => {
    const { storage, add } = setup();
    await add('g', 'e1', put('e1'));
    expect(await add('g', 'e1', { kind: 'expense.delete' })).toBeNull();
    expect(await storage.listOutbox()).toEqual([]);
  });

  test('deleting an expense that may have reached the server still sends the delete', async () => {
    const { storage, add } = setup();
    const entry = await add('g', 'e1', put('e1'));
    await storage.putOutbox({ ...entry!, lastAttemptAt: 1 });
    await add('g', 'e1', { kind: 'expense.delete' });
    expect((await storage.listOutbox()).map((e) => e.kind)).toEqual(['expense.delete']);
  });

  test('deleting after an edit of a synced expense replaces the PUT with a delete', async () => {
    const { storage, add } = setup();
    await add('g', 'e1', put('e1'), 2);
    await add('g', 'e1', { kind: 'expense.delete' }, 2);
    expect(await storage.listOutbox()).toMatchObject([{ kind: 'expense.delete', baseVersion: 2 }]);
  });

  test('a second settlement entry with the same id is the same payment', async () => {
    const { storage, add } = setup();
    const settlement = { kind: 'settlement.create', settlement: { id: 's1', fromID: 'a', toID: 'b', amountMinor: 5 } } as const;
    await add('g', 's1', settlement);
    await add('g', 's1', settlement);
    expect(await storage.listOutbox()).toHaveLength(1);
  });

  test('different records are never merged', async () => {
    const { storage, add } = setup();
    await add('g', 'x', put('x'));
    await add('g', 'x', { kind: 'member.put', memberID: 'x', name: 'Cy' });
    expect(await storage.listOutbox()).toHaveLength(2);
  });
});

describe('order', () => {
  test('a backing-off entry holds back later entries in the same group only', async () => {
    const { storage, clock, add } = setup();
    const a = await add('g1', 'e1', put('e1'));
    await add('g1', 'e2', put('e2'));
    await add('g2', 'e3', put('e3'));
    await storage.putOutbox({ ...a!, nextAttemptAt: clock.now() + 5000 });
    const entries = await storage.listOutbox();
    expect(nextForGroup(entries, 'g1', clock.now())).toEqual({ waitMs: 5000 });
    expect(nextForGroup(entries, 'g2', clock.now()).entry?.entityId).toBe('e3');
    expect(nextForGroup(entries, 'g1', clock.now() + 5000).entry?.entityId).toBe('e1');
    expect(nextRetryAt(entries)).toBe(0);
  });

  test('failed and conflict entries are parked and do not block the group', async () => {
    const { storage, clock, add } = setup();
    const a = await add('g', 'e1', put('e1'));
    await add('g', 'e2', put('e2'));
    await storage.putOutbox({ ...a!, status: 'failed' });
    expect(nextForGroup(await storage.listOutbox(), 'g', clock.now()).entry?.entityId).toBe('e2');
  });
});

describe('MemoryStorage transactions', () => {
  test('a thrown error rolls back every write in the transaction', async () => {
    const { storage, ctx } = setup();
    await expect(storage.transaction(async (tx) => {
      await tx.setMeta('k', 'v');
      await enqueue(tx, ctx, { groupId: 'g', entityId: 'e', payload: put('e'), baseVersion: null });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await storage.getMeta('k')).toBeUndefined();
    expect(await storage.listOutbox()).toEqual([]);
  });

  test('transactions do not interleave', async () => {
    const { storage } = setup();
    await Promise.all(Array.from({ length: 20 }, (_, i) => storage.transaction(async (tx) => {
      const n = Number((await tx.getMeta('n')) ?? 0);
      await Promise.resolve();
      await tx.setMeta('n', String(n + 1 + i * 0));
    })));
    expect(await storage.getMeta('n')).toBe('20');
  });
});
