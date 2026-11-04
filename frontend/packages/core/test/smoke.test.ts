import { randomUUID } from 'node:crypto';
import { Actions, AuthSession, HttpApi, MemoryStorage, MemoryTokenStore, SyncEngine } from '../src';

const baseUrl = process.env['SMOKE_API_URL'];
const suite = baseUrl ? describe : describe.skip;

suite('against the real backend', () => {
  const clock = { now: () => Date.now() };
  const random = { uuid: () => randomUUID(), next: () => Math.random() };

  function device() {
    const tokens = new MemoryTokenStore();
    let token: string | null = null;
    const api = new HttpApi({ baseUrl: baseUrl!, fetch: (url, init) => fetch(url, init), getToken: () => token });
    const auth = new AuthSession(api, { get: async () => token, set: async (t) => { token = t; await tokens.set(t); }, clear: async () => { token = null; await tokens.clear(); } });
    const storage = new MemoryStorage();
    const engine = new SyncEngine({ storage, api, clock, random });
    const actions = new Actions({ storage, clock, random, notify: engine.notify });
    return { api, auth, storage, engine, actions };
  }

  test('sign up, create a group and an expense offline, sync, and read it back on a second device', async () => {
    const email = `smoke-${randomUUID()}@example.com`;
    const a = device();
    await a.auth.register(email, 'Smoke Tester', 'a long password for tests');

    const group = await a.actions.createGroup({ name: 'Smoke trip', currencyCode: 'USD', members: [{ name: 'Smoke Tester' }, { name: 'Friend' }], meIndex: 0 });
    const [me, friend] = group.members;
    const expense = await a.actions.saveExpense(group.id, {
      merchant: 'Dinner', occurredAt: new Date().toISOString(), category: 'dining', notes: '', amountMinor: 9001,
      payerID: me!.id, method: 'equal', participants: [me!.id, friend!.id], values: [],
    });

    const result = await a.engine.sync();
    expect(result).toMatchObject({ pulled: true });
    expect(await a.engine.status()).toMatchObject({ waiting: 0, failed: 0, conflicts: 0, chip: 'synced' });
    expect((await a.storage.getExpense(expense.id))?.syncState).toBe('synced');

    const b = device();
    await b.auth.signIn(email, 'a long password for tests');
    await b.engine.sync();
    const groups = await b.storage.listGroups();
    expect(groups.map((g) => g.id)).toEqual([group.id]);
    const expenses = await b.storage.listExpenses(group.id);
    expect(expenses.map((e) => [e.id, e.amountMinor])).toEqual([[expense.id, 9001]]);
  });

  test('an edit and then a delete both sync and leave nothing waiting', async () => {
    const email = `smoke-${randomUUID()}@example.com`;
    const a = device();
    await a.auth.register(email, 'Smoke Tester', 'a long password for tests');
    const group = await a.actions.createGroup({ name: 'Edits', currencyCode: 'USD', members: [{ name: 'Smoke Tester' }], meIndex: 0 });
    const me = group.members[0]!;
    const base = { merchant: 'Lunch', occurredAt: new Date().toISOString(), category: 'dining', notes: '', payerID: me.id, method: 'equal' as const, participants: [me.id], values: [] as string[] };
    const expense = await a.actions.saveExpense(group.id, { ...base, amountMinor: 1000 });
    await a.engine.sync();
    await a.actions.saveExpense(group.id, { ...base, id: expense.id, amountMinor: 2500 });
    await a.engine.sync();
    expect((await a.storage.getExpense(expense.id))?.amountMinor).toBe(2500);
    await a.actions.deleteExpense(expense.id);
    await a.engine.sync();
    expect(await a.engine.status()).toMatchObject({ waiting: 0, failed: 0, chip: 'synced' });
  });
});
