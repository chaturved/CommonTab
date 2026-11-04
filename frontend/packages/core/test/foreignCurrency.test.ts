import {
  evaluateForm, formatRate, formFromExpense, MemoryStorage, newExpenseForm, parseRate, quoteRate, rateSentence, savedRate,
  type LocalExpense, type LocalGroup,
} from '../src';
import { FakeServer } from './fakeServer';
import { device, draft, TestClock } from './harness';

const group: LocalGroup = {
  id: 'g', name: 'Lisbon', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Ada', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }],
  syncState: 'synced', localOnly: false,
};
const NOW = new Date(2026, 10, 3, 12).getTime();
const euros = (over = {}) => ({ ...newExpenseForm(group, NOW), merchant: 'Hotel', amountText: '120.00', currencyCode: 'EUR', rateText: '1.08', ...over });

describe('parseRate and formatRate', () => {
  test.each([['1.08', 1_080_000], ['150.5', 150_500_000], ['0.0067', 6700], ['2', 2_000_000], [' 1.123456 ', 1_123_456]])('%p is %i millionths', (text, micros) => {
    expect(parseRate(text)).toBe(micros);
  });

  test.each(['', '0', '0.0', 'abc', '1.1234567', '-1', '1,08', '1.'])('%p is not a rate', (text) => expect(parseRate(text)).toBeNull());

  test.each([[1_080_000, '1.08'], [150_500_000, '150.50'], [6700, '0.0067'], [1_123_456, '1.123456'], [2_000_000, '2.00']])('%i shows as %s', (micros, text) => {
    expect(formatRate(micros)).toBe(text);
    expect(parseRate(text)).toBe(micros);
  });

  test('the sentence names both currencies', () => expect(rateSentence('EUR', 'USD', 1_080_000)).toBe('1 EUR = 1.08 USD'));
});

describe('a foreign-currency form', () => {
  test('counts as the converted amount and splits that', () => {
    const result = evaluateForm(euros(), 'USD');
    expect(result).toMatchObject({ amountMinor: 12960, originalMinor: 12000, errors: {} });
    expect(result.shares.map((s) => s.minorUnits)).toEqual([6480, 6480]);
    expect(result.draft).toMatchObject({ amountMinor: 12960, currencyCode: 'EUR', originalMinor: 12000, rateMicros: 1_080_000 });
  });

  test('the amount is read with the entered currency\'s decimals', () => {
    expect(evaluateForm(euros({ currencyCode: 'JPY', amountText: '5000', rateText: '0.0067' }), 'USD')).toMatchObject({ amountMinor: 3350, originalMinor: 5000 });
  });

  test('a missing rate blocks saving and says so', () => {
    const result = evaluateForm(euros({ rateText: '' }), 'USD');
    expect(result.errors.rate).toBe('Enter a rate');
    expect(result.draft).toBeNull();
  });

  test('an amount too small to convert is an amount error', () => {
    expect(evaluateForm(euros({ currencyCode: 'JPY', amountText: '1', rateText: '0.001' }), 'USD').errors.amount).toBe('That amount is too small to convert');
  });

  test('the group currency chosen as the entry currency is an ordinary expense', () => {
    const result = evaluateForm(euros({ currencyCode: 'USD', rateText: '' }), 'USD');
    expect(result.draft).not.toHaveProperty('currencyCode');
    expect(result.amountMinor).toBe(12000);
  });

  test('an ordinary form is unchanged', () => {
    expect(evaluateForm({ ...newExpenseForm(group, NOW), merchant: 'Lunch', amountText: '20' }, 'USD').draft).toMatchObject({ amountMinor: 2000 });
  });

  test('editing a saved one brings back the original amount, currency and rate', () => {
    const saved = { id: 'e', groupID: 'g', merchant: 'Hotel', occurredAt: '2026-11-03T12:00:00.000Z', category: 'travel', notes: '', amountMinor: 12960, payerID: 'me', method: 'equal',
      allocations: [{ memberID: 'me', minorUnits: 6480 }, { memberID: 'sam', minorUnits: 6480 }], values: [], version: 1, hasReceipt: false, updatedAt: '', deletedAt: null,
      currencyCode: 'EUR', originalMinor: 12000, rateMicros: 1_080_000, syncState: 'synced', history: [] } as LocalExpense;
    expect(formFromExpense(saved, 'USD')).toMatchObject({ amountText: '120.00', currencyCode: 'EUR', rateText: '1.08' });
  });
});

describe('quoteRate', () => {
  const api = (server: FakeServer) => server.api(() => 't');

  test('asks the server and keeps the answer for later', async () => {
    const server = new FakeServer(new TestClock());
    server.rates.set('EUR:USD', 1_080_000);
    const storage = new MemoryStorage();

    expect(await quoteRate(api(server), storage, 'EUR', 'USD')).toEqual({ rateMicros: 1_080_000, date: '2026-11-02', fresh: true });
    expect(await savedRate(storage, 'EUR', 'USD')).toEqual({ rateMicros: 1_080_000, date: '2026-11-02', fresh: false });
  });

  test('offline it gives the saved rate, marked as not fresh', async () => {
    const server = new FakeServer(new TestClock());
    server.rates.set('EUR:USD', 1_080_000);
    const storage = new MemoryStorage();
    await quoteRate(api(server), storage, 'EUR', 'USD');
    server.offline = true;

    expect(await quoteRate(api(server), storage, 'EUR', 'USD')).toEqual({ rateMicros: 1_080_000, date: '2026-11-02', fresh: false });
  });

  test('with nothing saved and no connection there is no rate', async () => {
    const server = new FakeServer(new TestClock());
    server.offline = true;

    expect(await quoteRate(api(server), new MemoryStorage(), 'EUR', 'USD')).toBeNull();
  });

  test('a saved rate is per pair', async () => {
    const server = new FakeServer(new TestClock());
    server.rates.set('EUR:USD', 1_080_000);
    const storage = new MemoryStorage();
    await quoteRate(api(server), storage, 'EUR', 'USD');

    expect(await savedRate(storage, 'USD', 'EUR')).toBeNull();
  });
});

describe('a foreign-currency expense through sync', () => {
  const foreign = { currencyCode: 'EUR', originalMinor: 12000, rateMicros: 1_080_000, amountMinor: 12960 };

  async function world() {
    const clock = new TestClock();
    const server = new FakeServer(clock);
    const phone = device(server, clock, 'Ada');
    const created = await phone.actions.createGroup({ name: 'Lisbon', currencyCode: 'USD', members: [{ name: 'Ada' }, { name: 'Bob' }], meIndex: 0 });
    await phone.engine.sync();
    return { server, clock, phone, groupId: created.id, me: created.members[0]!.id, bob: created.members[1]!.id };
  }

  test('the original amount and rate are saved locally, sent, and read back by another device', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], foreign));
    expect(saved).toMatchObject(foreign);
    await w.phone.engine.sync();
    expect(w.server.groups.get(w.groupId)!.expenses.get(saved.id)).toMatchObject(foreign);

    const tablet = device(w.server, w.clock, 'Tablet');
    tablet.token = w.phone.token;
    await tablet.engine.sync();
    expect(await tablet.storage.getExpense(saved.id)).toMatchObject(foreign);
  });

  test('editing it back to the group currency removes the foreign fields', async () => {
    const w = await world();
    const saved = await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], foreign));
    await w.phone.engine.sync();

    const edited = await w.phone.actions.saveExpense(w.groupId, { ...draft(w.me, [w.me, w.bob], { amountMinor: 12960 }), id: saved.id });
    await w.phone.engine.sync();

    expect(edited.currencyCode).toBeUndefined();
    expect(w.server.groups.get(w.groupId)!.expenses.get(saved.id)!.currencyCode).toBeNull();
  });

  test('balances use the converted amount only', async () => {
    const w = await world();
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob], foreign));
    await w.phone.engine.sync();

    const balances = w.server.snapshot(w.server.groups.get(w.groupId)!, 'user-1').balances;
    expect(balances.find((b) => b.memberID === w.me)!.minorUnits).toBe(6480);
  });
});
