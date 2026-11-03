import { expenseRow, longDate, timeAgo, overallTotals, positionIn, shortDate, sortForList, summarizeGroup, type LocalExpense, type LocalGroup, type LocalSettlement } from '../src';

const group = (over: Partial<LocalGroup> = {}): LocalGroup => ({
  id: 'g', name: 'Austin Trip', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Chaturved', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }, { id: 'riya', name: 'Riya', userID: null, email: null }],
  syncState: 'synced', localOnly: false, ...over,
});

const expense = (id: string, amountMinor: number, payerID: string, shares: Record<string, number>, over: Partial<LocalExpense> = {}): LocalExpense => ({
  id, groupID: 'g', merchant: id, occurredAt: '2026-10-30T18:00:00Z', category: 'dining', notes: '', amountMinor, payerID,
  method: 'equal', allocations: Object.entries(shares).map(([memberID, minorUnits]) => ({ memberID, minorUnits })), values: [],
  version: 1, hasReceipt: false, updatedAt: '2026-10-30T18:00:00Z', deletedAt: null, syncState: 'synced', history: [], ...over,
});

const dinner = expense('Dinner', 16350, 'me', { me: 5450, sam: 5450, riya: 5450 });

describe('summarizeGroup', () => {
  test('I paid for three: both friends owe me their share', () => {
    const s = summarizeGroup(group(), [dinner], []);
    expect(s.myBalance).toBe(10900);
    expect(s.counterparts.map((c) => [c.name, c.direction, c.minorUnits]).sort()).toEqual([['Riya', 'owesMe', 5450], ['Sam', 'owesMe', 5450]]);
    expect(s).toMatchObject({ status: 'needsSettling', expenseCount: 1, totalMinor: 16350, memberCount: 3, waiting: 0 });
    expect(s.memberNames).toEqual(['You', 'Sam', 'Riya']);
  });

  test('a friend paid: I owe them', () => {
    const s = summarizeGroup(group(), [expense('Brunch', 5400, 'sam', { me: 1800, sam: 1800, riya: 1800 })], []);
    expect(s.myBalance).toBe(-1800);
    expect(s.counterparts).toEqual([{ memberID: 'sam', name: 'Sam', direction: 'iOwe', minorUnits: 1800 }]);
  });

  test('settlements square the group, which then reads settled', () => {
    const payments: LocalSettlement[] = ['sam', 'riya'].map((from) => ({ id: from, groupID: 'g', fromID: from, toID: 'me', amountMinor: 5450, createdAt: '2026-11-02T10:00:00Z', syncState: 'synced' }));
    const s = summarizeGroup(group(), [dinner], payments);
    expect(s).toMatchObject({ myBalance: 0, status: 'settled', counterparts: [] });
  });

  test('a group with no expenses is new, not settled', () => {
    expect(summarizeGroup(group(), [], []).status).toBe('new');
  });

  test('deleted expenses are ignored', () => {
    const s = summarizeGroup(group(), [{ ...dinner, deletedAt: '2026-11-01T00:00:00Z', syncState: 'pending' }], []);
    expect(s).toMatchObject({ expenseCount: 0, myBalance: 0, waiting: 1 });
  });

  test('counts everything not yet synced, including the group itself', () => {
    const s = summarizeGroup(group({ syncState: 'pending' }), [{ ...dinner, syncState: 'pending' }, { ...dinner, id: 'x', syncState: 'failed' }], []);
    expect(s.waiting).toBe(3);
  });
});

describe('overallTotals and sorting', () => {
  const a = summarizeGroup(group({ id: 'a', name: 'Apartment' }), [expense('Rent', 3600, 'sam', { me: 1200, sam: 1200, riya: 1200 })], []);
  const b = summarizeGroup(group({ id: 'b', name: 'Austin' }), [dinner], []);

  test('splits what I owe from what I am owed and nets them', () => {
    expect(overallTotals([a, b])).toEqual([{ currencyCode: 'USD', owe: 1200, owed: 10900, net: 9700 }]);
  });

  test('keeps currencies apart', () => {
    const eur = { ...b, currencyCode: 'EUR' };
    expect(overallTotals([a, eur]).map((t) => t.currencyCode)).toEqual(['USD', 'EUR']);
  });

  test('the biggest balance comes first, ties by name', () => {
    expect(sortForList([a, b]).map((s) => s.name)).toEqual(['Austin', 'Apartment']);
  });

  test('groups that need settling come before new ones, and settled ones are last', () => {
    const fresh = summarizeGroup(group({ id: 'c', name: 'Brand new' }), [], []);
    const payments: LocalSettlement[] = ['sam', 'riya'].map((from) => ({ id: from, groupID: 'g', fromID: from, toID: 'me', amountMinor: 5450, createdAt: '2026-11-02T10:00:00Z', syncState: 'synced' }));
    const done = summarizeGroup(group({ id: 'd', name: 'Aardvark' }), [dinner], payments);
    expect(sortForList([done, fresh, a, b]).map((s) => s.name)).toEqual(['Austin', 'Apartment', 'Brand new', 'Aardvark']);
  });
});

describe('expense rows', () => {
  test('lent, owe, and not involved', () => {
    expect(positionIn(dinner, 'me')).toEqual({ kind: 'lent', minorUnits: 10900 });
    expect(positionIn(dinner, 'sam')).toEqual({ kind: 'owe', minorUnits: 5450 });
    expect(positionIn(expense('x', 1000, 'sam', { sam: 1000 }), 'me')).toEqual({ kind: 'none', minorUnits: 0 });
  });

  test('subtitles read like the designs', () => {
    const row = expenseRow(dinner, group());
    expect(row.groupSubtitle).toBe('You paid $163.50 · Oct 30');
    expect(row.homeSubtitle).toBe('Austin Trip · You paid · Oct 30');
    expect(row.words).toBe('you lent');
    const other = expenseRow(expense('Brunch', 5400, 'sam', { me: 1800, sam: 3600 }), group());
    expect(other.groupSubtitle).toBe('Sam paid $54.00 · Oct 30');
    expect(other.homeSubtitle).toBe('Austin Trip · Paid by Sam · Oct 30');
  });

  test('says whether a waiting change is new or an edit', () => {
    expect(expenseRow({ ...dinner, version: 0, syncState: 'pending' }, group()).pendingLabel).toBe('New · waiting to sync');
    expect(expenseRow({ ...dinner, syncState: 'pending' }, group()).pendingLabel).toBe('Edited · waiting to sync');
    expect(expenseRow(dinner, group()).pendingLabel).toBeNull();
  });

  test('dates are the UTC day', () => {
    expect(shortDate('2026-11-01T23:59:00Z')).toBe('Nov 1');
    expect(longDate('2026-10-30T18:00:00Z')).toBe('Oct 30, 2026');
  });
});

describe('timeAgo', () => {
  const now = Date.UTC(2026, 10, 3, 12, 0);
  test.each([
    [0, 'just now'], [60_000, '1 minute ago'], [59 * 60_000, '59 minutes ago'], [2 * 3_600_000, '2 hours ago'], [26 * 3_600_000, '1 day ago'], [5 * 86_400_000, '5 days ago'],
  ])('%i ms ago reads %s', (ago, text) => {
    expect(timeAgo(now - ago, now)).toBe(text);
  });
});
