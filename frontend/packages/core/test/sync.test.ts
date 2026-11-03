import { applySnapshot, type LocalExpense } from '../src';
import { FakeServer } from './fakeServer';
import { device, draft, TestClock, type Device } from './harness';

interface World { server: FakeServer; clock: TestClock; phone: Device; groupId: string; me: string; bob: string }

/** Ada's phone with a group (Ada and Bob, who has no account) that is already on the server and synced. */
async function world(): Promise<World> {
  const clock = new TestClock();
  const server = new FakeServer(clock);
  const phone = device(server, clock, 'Ada');
  const group = await phone.actions.createGroup({ name: 'Flat', currencyCode: 'USD', members: [{ name: 'Ada' }, { name: 'Bob' }], meIndex: 0 });
  await phone.engine.sync();
  return { server, clock, phone, groupId: group.id, me: group.members[0]!.id, bob: group.members[1]!.id };
}

/** The same account on a second device, already caught up. */
async function secondDevice(w: World, name = 'Tablet'): Promise<Device> {
  const other = device(w.server, w.clock, name);
  other.token = w.phone.token;
  await other.engine.sync();
  return other;
}

const expense = async (d: Device, id: string) => (await d.storage.getExpense(id)) as LocalExpense;
const outbox = (d: Device) => d.storage.listOutbox();
const serverExpense = (w: World, id: string) => w.server.groups.get(w.groupId)!.expenses.get(id)!;

describe('local first', () => {
  test('a new group, person and expense are saved on the phone and reach the server on sync', async () => {
    const w = await world();
    expect(w.server.groups.get(w.groupId)!.members.map((m) => m.name)).toEqual(['Ada', 'Bob']);
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    expect(saved).toMatchObject({ syncState: 'pending', version: 0 });
    expect(saved.allocations.map((a) => a.minorUnits)).toEqual([5000, 5000]); // computed on the phone
    expect(w.server.groups.get(w.groupId)!.expenses.size).toBe(0);

    await w.phone.engine.sync();
    expect(await outbox(w.phone)).toEqual([]);
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', version: 1 });
    expect(serverExpense(w, saved.id)).toMatchObject({ amountMinor: 10000 });
  });

  test('saving while offline never touches the network', async () => {
    const w = await world();
    w.server.offline = true;
    w.server.log.length = 0;
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    expect(w.server.log).toEqual([]);
    expect(await outbox(w.phone)).toHaveLength(1);
    expect((await w.phone.engine.status()).chip).toBe('waiting');
    expect(saved.syncState).toBe('pending');
  });

  test('an invalid split throws before anything is saved', async () => {
    const w = await world();
    await expect(w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { method: 'exact', values: ['1', '2'] }))).rejects.toThrow();
    expect(await outbox(w.phone)).toEqual([]);
    expect(await w.phone.storage.listExpenses(w.groupId)).toEqual([]);
  });

  test('a person with no account can pay and share', async () => {
    const w = await world();
    const cy = await w.phone.actions.putMember(w.groupId, { name: 'Cy' });
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(cy.id, [cy.id, w.bob], { amountMinor: 3001 }));
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.members.map((m) => m.name)).toContain('Cy');
    expect((await expense(w.phone, saved.id)).allocations.map((a) => a.minorUnits)).toEqual([1501, 1500]);
  });

  test('a rename of a person is queued and sent', async () => {
    const w = await world();
    await w.phone.actions.putMember(w.groupId, { id: w.bob, name: 'Robert' });
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.members.find((m) => m.id === w.bob)!.name).toBe('Robert');
  });
});

describe('offline, retry and backoff', () => {
  test('airplane mode: add, edit and delete queue up, then send once with no duplicates', async () => {
    const w = await world();
    w.server.offline = true;
    const keep = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Keep' }));
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: keep.id, merchant: 'Keep (edited)' }));
    const gone = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Gone' }));
    await w.phone.actions.deleteExpense(gone.id);
    expect((await outbox(w.phone)).map((e) => e.entityId)).toEqual([keep.id]); // edit coalesced, delete cancelled
    expect(await w.phone.storage.getExpense(gone.id)).toBeUndefined();

    await w.phone.engine.sync(); // still offline
    expect(await w.phone.engine.status()).toMatchObject({ connectivity: 'offline', waiting: 1, chip: 'waiting' });
    w.server.offline = false;
    w.server.log.length = 0;
    w.clock.advance(10_000);
    await w.phone.engine.sync();
    expect(w.server.log.filter((l) => l.startsWith('PUT expense'))).toEqual([`PUT expense ${keep.id}`]);
    expect([...w.server.groups.get(w.groupId)!.expenses.values()].map((e) => e.merchant)).toEqual(['Keep (edited)']);
    expect(await w.phone.engine.status()).toMatchObject({ connectivity: 'online', waiting: 0, chip: 'synced' });
  });

  test('a failure backs off 2s, then 4s, and sync before that time sends nothing', async () => {
    const w = await world();
    w.server.offline = true;
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    expect((await outbox(w.phone))[0]).toMatchObject({ attempts: 1, nextAttemptAt: w.clock.now() + 2000 });

    w.clock.advance(1000);
    w.server.offline = false;
    w.server.log.length = 0;
    await w.phone.engine.sync();
    expect(w.server.log.filter((l) => l.startsWith('PUT'))).toEqual([]); // not due yet

    w.clock.advance(1000);
    w.server.offline = true;
    await w.phone.engine.sync();
    expect((await outbox(w.phone))[0]).toMatchObject({ attempts: 2, nextAttemptAt: w.clock.now() + 4000 });
    expect((await w.phone.engine.status()).nextRetryAt).toBe(w.clock.now() + 4000);
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'pending' });
  });

  test('a 503 is retried like a lost connection and /healthz says the server is down', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.failNext.push({ status: 503 });
    w.server.unhealthy = true;
    await w.phone.engine.sync();
    expect(await w.phone.engine.status()).toMatchObject({ connectivity: 'serverDown', waiting: 1 });
  });

  test('429 waits at least as long as Retry-After', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.failNext.push({ status: 429, code: 'rate_limited', extra: { retryAfterSeconds: 45 } });
    await w.phone.engine.sync();
    expect((await outbox(w.phone))[0]).toMatchObject({ status: 'ready', nextAttemptAt: w.clock.now() + 45_000 });
  });

  test('a group that is backing off does not hold back another group', async () => {
    const w = await world();
    const trip = await w.phone.actions.createGroup({ name: 'Trip', currencyCode: 'USD', members: [{ name: 'Ada' }], meIndex: 0 });
    await w.phone.engine.sync();
    const meTrip = trip.members[0]!.id;
    const blocked = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'blocked' }));
    await w.phone.engine.sync();
    await w.phone.storage.transaction(async (tx) => {
      for (const e of await tx.listOutbox()) await tx.putOutbox({ ...e, nextAttemptAt: w.clock.now() + 60_000 });
    });
    const free = await w.phone.actions.saveExpense(trip.id, draft(meTrip, [meTrip], { merchant: 'free' }));
    await w.phone.engine.sync();
    expect(w.server.groups.get(trip.id)!.expenses.has(free.id)).toBe(true);
    expect(w.server.groups.get(w.groupId)!.expenses.has(blocked.id)).toBe(true); // it had already been sent once
  });

  test('order inside a group is kept: a person is added before the expense that uses them', async () => {
    const w = await world();
    const cy = await w.phone.actions.putMember(w.groupId, { name: 'Cy' });
    await w.phone.actions.saveExpense(w.groupId, draft(cy.id, [cy.id]));
    w.server.log.length = 0;
    await w.phone.engine.sync();
    expect(w.server.log.filter((l) => l.startsWith('PUT'))[0]).toBe(`PUT member ${cy.id}`);
  });

  test('a backing-off entry holds back the ones after it in the same group', async () => {
    const w = await world();
    const first = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'first' }));
    const second = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'second' }));
    w.server.offline = true;
    await w.phone.engine.sync(); // the first fails and backs off
    w.server.offline = false;
    w.server.log.length = 0;
    await w.phone.engine.sync();
    expect(w.server.log.filter((l) => l.startsWith('PUT'))).toEqual([]);
    expect(w.server.groups.get(w.groupId)!.expenses.has(second.id)).toBe(false);
    w.clock.advance(2000);
    await w.phone.engine.sync();
    expect([...w.server.groups.get(w.groupId)!.expenses.keys()]).toEqual([first.id, second.id]);
  });
});

describe('idempotent retry: the connection drops after the server applied a write', () => {
  test('the retry yields one expense', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.dropResponses = 1;
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.expenses.size).toBe(1); // applied
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'pending' }); // the phone doesn't know

    w.clock.advance(5000);
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.expenses.size).toBe(1);
    expect(serverExpense(w, saved.id).version).toBe(1);
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', version: 1 });
    expect(await outbox(w.phone)).toEqual([]);
  });

  test('an edit whose response was lost is not a conflict with itself', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Edited' }));
    w.server.dropResponses = 1;
    await w.phone.engine.sync();
    w.clock.advance(5000);
    await w.phone.engine.sync();
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', merchant: 'Edited' });
    expect(serverExpense(w, saved.id).version).toBe(2);
  });

  test('a delete whose response was lost is repeated safely', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    await w.phone.actions.deleteExpense(saved.id);
    w.server.dropResponses = 1;
    await w.phone.engine.sync();
    w.clock.advance(5000);
    await w.phone.engine.sync();
    expect(serverExpense(w, saved.id)).toMatchObject({ version: 2 });
    expect(await outbox(w.phone)).toEqual([]);
  });

  test('a payment whose response was lost is recorded once', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    const payment = await w.phone.actions.addSettlement(w.groupId, { fromID: w.bob, toID: w.me, amountMinor: 2000 });
    w.server.dropResponses = 1;
    await w.phone.engine.sync();
    w.clock.advance(5000);
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.settlements).toHaveLength(1);
    expect(await w.phone.storage.getSettlement(payment.id)).toMatchObject({ syncState: 'synced' });
  });

  test('a group create whose response was lost does not make a second group', async () => {
    const clock = new TestClock();
    const server = new FakeServer(clock);
    const phone = device(server, clock, 'Ada');
    await phone.actions.createGroup({ name: 'Flat', currencyCode: 'USD', members: [{ name: 'Ada' }], meIndex: 0 });
    server.dropResponses = 1;
    await phone.engine.sync();
    clock.advance(5000);
    await phone.engine.sync();
    expect(server.groups.size).toBe(1);
    expect((await phone.storage.listGroups())[0]).toMatchObject({ syncState: 'synced', version: 1 });
  });

  test('editing while a send is in flight keeps the newer edit, built on the stored version', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    // The person edits after the server stored the first version but before the phone hears about it.
    w.server.afterNextWrite = async () => {
      await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Second thoughts' }));
    };
    await w.phone.engine.sync();
    // The second edit was built on version 1 (the stored one), so it is accepted rather than conflicting.
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', merchant: 'Second thoughts', version: 2 });
    expect(serverExpense(w, saved.id)).toMatchObject({ merchant: 'Second thoughts', version: 2 });
    expect(await outbox(w.phone)).toEqual([]);
    expect(w.server.groups.get(w.groupId)!.expenses.size).toBe(1);
  });

  test('overlapping sync calls share one run', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.log.length = 0;
    await Promise.all([w.phone.engine.sync(), w.phone.engine.sync(), w.phone.engine.sync()]);
    expect(w.server.log.filter((l) => l.startsWith('PUT expense'))).toHaveLength(1);
  });
});

describe('a second device edits the same expense', () => {
  /** Both devices hold "Dinner"; the phone edits first, the tablet edits later and reaches the server first. */
  async function phoneLoses() {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Dinner' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    const id = saved.id;
    w.clock.advance(1000);
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id, merchant: 'Dinner (phone)' }));
    w.clock.advance(1000);
    await tablet.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id, merchant: 'Dinner (tablet)' }));
    await tablet.engine.sync();
    w.clock.advance(1);
    await w.phone.engine.sync();
    return { ...w, tablet, id };
  }

  test('a new device pulls the account\'s groups, people and expenses', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Dinner' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    expect(await tablet.storage.getGroup(w.groupId)).toMatchObject({ name: 'Flat', meMemberID: w.me, syncState: 'synced' });
    expect(await expense(tablet, saved.id)).toMatchObject({ merchant: 'Dinner', syncState: 'synced' });
  });

  test('the older edit loses: the server version is shown and the loser is kept for "Keep mine"', async () => {
    const w = await phoneLoses();
    expect(serverExpense(w, w.id).merchant).toBe('Dinner (tablet)');
    const lost = await expense(w.phone, w.id);
    expect(lost).toMatchObject({ syncState: 'conflict', merchant: 'Dinner (tablet)', version: 2 });
    expect(lost.conflict!.mine.merchant).toBe('Dinner (phone)');
    expect(await outbox(w.phone)).toEqual([]);
    expect(await w.phone.engine.status()).toMatchObject({ conflicts: 1, chip: 'failed' });
  });

  test('a later pull does not overwrite the conflict', async () => {
    const w = await phoneLoses();
    await w.phone.engine.sync();
    expect(await expense(w.phone, w.id)).toMatchObject({ syncState: 'conflict' });
  });

  test('a conflicted expense cannot be edited until it is resolved', async () => {
    const w = await phoneLoses();
    await expect(w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: w.id }))).rejects.toThrow('conflict');
  });

  test('"Keep mine" sends again on top of the server version and the other device is told', async () => {
    const w = await phoneLoses();
    await w.phone.actions.resolveConflict(w.id, 'mine');
    expect(await expense(w.phone, w.id)).toMatchObject({ syncState: 'pending', merchant: 'Dinner (phone)' });
    await w.phone.engine.sync();
    expect(serverExpense(w, w.id)).toMatchObject({ merchant: 'Dinner (phone)', version: 3 });
    expect(await expense(w.phone, w.id)).toMatchObject({ syncState: 'synced', merchant: 'Dinner (phone)' });

    await w.tablet.engine.sync();
    const told = await expense(w.tablet, w.id);
    expect(told).toMatchObject({ merchant: 'Dinner (phone)', syncState: 'synced' });
    expect(told.history[0]).toMatchObject({ reason: 'edited_elsewhere' });
  });

  test('"Keep theirs" keeps the server version and files the edit in the history', async () => {
    const w = await phoneLoses();
    await w.phone.actions.resolveConflict(w.id, 'theirs');
    const after = await expense(w.phone, w.id);
    expect(after).toMatchObject({ syncState: 'synced', merchant: 'Dinner (tablet)' });
    expect(after.conflict).toBeUndefined();
    expect(after.history[0]).toMatchObject({ reason: 'you_chose_theirs' });
    expect(await outbox(w.phone)).toEqual([]);
    expect(serverExpense(w, w.id).version).toBe(2);
  });

  test('when this device\'s edit is the newer one it is sent on top automatically', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Dinner' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    w.clock.advance(1000);
    await tablet.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Dinner (tablet)' }));
    w.clock.advance(1000);
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Dinner (phone)' }));
    await tablet.engine.sync(); // reaches the server first, but its edit is the older one
    await w.phone.engine.sync();

    expect(serverExpense(w, saved.id)).toMatchObject({ merchant: 'Dinner (phone)', version: 3 });
    const mine = await expense(w.phone, saved.id);
    expect(mine).toMatchObject({ syncState: 'synced', merchant: 'Dinner (phone)' });
    expect(mine.history.some((h) => h.reason === 'overwritten_by_you')).toBe(true);
  });

  test('delete wins over an edit made on another device, and "Restore" brings it back', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Dinner' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    w.clock.advance(1000);
    await tablet.actions.deleteExpense(saved.id);
    await tablet.engine.sync();
    w.clock.advance(1000);
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Dinner (edited)' }));
    await w.phone.engine.sync();

    const stuck = await expense(w.phone, saved.id);
    expect(stuck).toMatchObject({ syncState: 'conflict' });
    expect(stuck.deletedAt).not.toBeNull();
    expect(stuck.conflict!.mine.merchant).toBe('Dinner (edited)');

    await w.phone.actions.resolveConflict(saved.id, 'mine'); // Restore
    await w.phone.engine.sync();
    expect(serverExpense(w, saved.id)).toMatchObject({ deletedAt: null, merchant: 'Dinner (edited)', version: 3 });
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', deletedAt: null });
  });

  test('a delete on this phone wins over an edit from another device, whatever its version', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    await tablet.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'edited' }));
    await tablet.engine.sync();
    await w.phone.actions.deleteExpense(saved.id);
    await w.phone.engine.sync();
    expect(serverExpense(w, saved.id).deletedAt).not.toBeNull();
    await tablet.engine.sync();
    expect((await expense(tablet, saved.id)).deletedAt).not.toBeNull();
  });
});

describe('pull', () => {
  test('never overwrites a pending record', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Mine' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    await tablet.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Theirs' }));
    await tablet.engine.sync();

    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Local edit' }));
    await w.phone.storage.transaction(async (tx) => { // not due yet: the run pulls without pushing
      for (const e of await tx.listOutbox()) await tx.putOutbox({ ...e, nextAttemptAt: w.clock.now() + 60_000 });
    });
    await w.phone.engine.sync();
    expect(await expense(w.phone, saved.id)).toMatchObject({ merchant: 'Local edit', syncState: 'pending' });
  });

  test('never overwrites a failed record', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'Original' }));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    await tablet.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Theirs' }));
    await tablet.engine.sync();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Mine' }));
    w.server.failNext.push({ status: 422 });
    await w.phone.engine.sync(); // the push is refused, then the pull runs
    expect(await expense(w.phone, saved.id)).toMatchObject({ merchant: 'Mine', syncState: 'failed' });
  });

  test('replaces synced records and learns about deletes made elsewhere', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    const tablet = await secondDevice(w);
    await tablet.actions.deleteExpense(saved.id);
    await tablet.engine.sync();
    await w.phone.engine.sync();
    const local = await expense(w.phone, saved.id);
    expect(local).toMatchObject({ syncState: 'synced', version: 2 });
    expect(local.deletedAt).not.toBeNull();
  });

  test('keeps a person added on this phone whose push has not landed yet', async () => {
    const w = await world();
    w.server.offline = true;
    await w.phone.actions.putMember(w.groupId, { name: 'Cy' });
    w.server.offline = false;
    const snapshot = (await w.server.api(() => w.phone.token).listGroups())[0]!;
    await w.phone.storage.transaction((tx) => applySnapshot(tx, snapshot, 0));
    expect((await w.phone.storage.getGroup(w.groupId))!.members.map((m) => m.name)).toEqual(['Ada', 'Bob', 'Cy']);
  });

  test('a restart with a pending queue picks up where it left off', async () => {
    const w = await world();
    w.server.offline = true;
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    await w.phone.engine.sync();
    const relaunched = device(w.server, w.clock, 'Ada again', undefined, w.phone.storage);
    relaunched.token = w.phone.token;
    w.server.offline = false;
    w.clock.advance(10_000);
    await relaunched.engine.sync();
    expect(await outbox(relaunched)).toEqual([]);
    expect(w.server.groups.get(w.groupId)!.expenses.has(saved.id)).toBe(true);
  });
});

describe('refusals and expired sessions', () => {
  async function owing() {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob])); // Bob owes Ada 5000
    await w.phone.engine.sync();
    return w;
  }

  test('a payment over what is owed is marked failed, keeps what was typed, and says the most that can be paid', async () => {
    const w = await owing();
    const payment = await w.phone.actions.addSettlement(w.groupId, { fromID: w.bob, toID: w.me, amountMinor: 9000 });
    await w.phone.engine.sync();
    expect(await w.phone.storage.getSettlement(payment.id)).toMatchObject({
      syncState: 'failed', amountMinor: 9000, error: { status: 422, code: 'exceeds_balance', maxAmountMinor: 5000 },
    });
    expect(await w.phone.engine.status()).toMatchObject({ failed: 1, waiting: 0, chip: 'failed' });
  });

  test('Discard removes a refused payment', async () => {
    const w = await owing();
    const payment = await w.phone.actions.addSettlement(w.groupId, { fromID: w.bob, toID: w.me, amountMinor: 9000 });
    await w.phone.engine.sync();
    await w.phone.actions.discardFailed((await outbox(w.phone))[0]!.opId);
    expect(await w.phone.storage.getSettlement(payment.id)).toBeUndefined();
    expect(await outbox(w.phone)).toEqual([]);
    expect(await w.phone.engine.status()).toMatchObject({ failed: 0, chip: 'synced' });
  });

  test('a refused change does not stop the changes after it', async () => {
    const w = await owing();
    await w.phone.actions.addSettlement(w.groupId, { fromID: w.bob, toID: w.me, amountMinor: 9000 });
    const later = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me], { merchant: 'After' }));
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.expenses.has(later.id)).toBe(true);
  });

  test('a 422 on an expense marks it failed, keeps it, and editing it sends it again', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.failNext.push({ status: 422, code: 'invalid' });
    await w.phone.engine.sync();
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'failed', merchant: 'Groceries', error: { status: 422, code: 'invalid' } });
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { id: saved.id, merchant: 'Fixed' }));
    await w.phone.engine.sync();
    expect(await expense(w.phone, saved.id)).toMatchObject({ syncState: 'synced', merchant: 'Fixed' });
  });

  test('Discard on a refused new expense removes it from the phone', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));
    w.server.failNext.push({ status: 422 });
    await w.phone.engine.sync();
    await w.phone.actions.discardFailed((await outbox(w.phone))[0]!.opId);
    expect(await w.phone.storage.getExpense(saved.id)).toBeUndefined();
  });

  test('token expiry mid-sync pauses the queue, loses nothing, and resumes after sign-in', async () => {
    const w = await world();
    const first = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'one' }));
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'two' }));
    w.server.expire(w.phone.token!);
    const result = await w.phone.engine.sync();
    expect(result.skipped).toBe('sessionExpired');
    expect(await w.phone.engine.status()).toMatchObject({ connectivity: 'sessionExpired', waiting: 2 });
    expect((await outbox(w.phone)).every((e) => e.status === 'ready' && e.attempts === 0)).toBe(true);

    w.server.log.length = 0;
    await w.phone.engine.sync();
    expect(w.server.log).toEqual([]); // paused: no calls until sign-in

    const fresh = await w.server.api(() => null).login({ email: 'ada@example.com', password: 'correct horse battery' });
    w.phone.token = fresh.accessToken;
    w.phone.engine.resume();
    await w.phone.engine.sync();
    expect(await outbox(w.phone)).toEqual([]);
    expect(w.server.groups.get(w.groupId)!.expenses.size).toBe(2);
    expect(await expense(w.phone, first.id)).toMatchObject({ syncState: 'synced' });
  });

  test('the token expiring half way keeps the entries that were not sent', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'one' }));
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], { merchant: 'two' }));
    w.server.afterNextWrite = async () => w.server.expire(w.phone.token!);
    await w.phone.engine.sync();
    expect(await w.phone.engine.status()).toMatchObject({ connectivity: 'sessionExpired', waiting: 1 });
  });
});

describe('local-only groups and upload', () => {
  async function oldTrip() {
    const clock = new TestClock();
    const server = new FakeServer(clock);
    const phone = device(server, clock, 'Ada');
    const g = await phone.actions.createGroup({ name: 'Old trip', currencyCode: 'USD', members: [{ name: 'Ada' }, { name: 'Bob' }], meIndex: 0, localOnly: true });
    const [me, bob] = g.members.map((m) => m.id) as [string, string];
    return { clock, server, phone, g, me, bob };
  }

  test('stay on the phone until uploaded, then send the group, its people, expenses and payments', async () => {
    const { server, phone, g, me, bob } = await oldTrip();
    const e = await phone.actions.saveExpense(g.id, draft(me, [me, bob]));
    await phone.actions.addSettlement(g.id, { fromID: bob, toID: me, amountMinor: 1000 });
    await phone.engine.sync();
    expect(server.groups.size).toBe(0);
    expect(await outbox(phone)).toEqual([]);

    await phone.actions.uploadGroup(g.id);
    await phone.engine.sync();
    expect(server.groups.get(g.id)!.expenses.has(e.id)).toBe(true);
    expect(server.groups.get(g.id)!.settlements).toHaveLength(1);
    expect(server.groups.get(g.id)!.members.map((m) => m.name)).toEqual(['Ada', 'Bob']);
    expect(await phone.storage.getGroup(g.id)).toMatchObject({ localOnly: false, syncState: 'synced' });
  });

  test('an upload interrupted part-way continues on the next run', async () => {
    const { clock, server, phone, g, me, bob } = await oldTrip();
    await phone.actions.saveExpense(g.id, draft(me, [me, bob], { merchant: 'one' }));
    await phone.actions.saveExpense(g.id, draft(me, [me, bob], { merchant: 'two' }));
    await phone.actions.uploadGroup(g.id);
    server.dropResponses = 1; // the group is created, but the phone never hears
    await phone.engine.sync();
    clock.advance(5000);
    await phone.engine.sync();
    expect(server.groups.get(g.id)!.expenses.size).toBe(2);
    expect(await outbox(phone)).toEqual([]);
  });

  test('a refused group create is discarded back to "On this phone only"', async () => {
    const { server, phone, g, me, bob } = await oldTrip();
    await phone.actions.saveExpense(g.id, draft(me, [me, bob]));
    await phone.actions.uploadGroup(g.id);
    server.failNext.push({ status: 409, code: 'id_conflict' });
    await phone.engine.sync();
    expect(await phone.storage.getGroup(g.id)).toMatchObject({ syncState: 'failed' });
    await phone.actions.discardFailed((await outbox(phone)).find((e) => e.kind === 'group.create')!.opId);
    expect(await phone.storage.getGroup(g.id)).toMatchObject({ localOnly: true });
    expect(await outbox(phone)).toEqual([]);
  });
});
