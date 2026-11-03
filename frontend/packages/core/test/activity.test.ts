import { activityFeed, byDay, dayLabel, describeActivity, expenseHistory, PersistentStorage, timeOfDay, type ActivityEvent, type LocalGroup, type StorageDriver, type StoredRow, type StoredWrite } from '../src';
import { FakeServer } from './fakeServer';
import { device, TestClock } from './harness';

const group: LocalGroup = {
  id: 'g', name: 'Austin Trip', currencyCode: 'USD', ownerID: 'me', meMemberID: 'me', version: 1,
  members: [{ id: 'me', name: 'Chaturved', userID: 'u', email: null }, { id: 'sam', name: 'Sam', userID: null, email: null }, { id: 'riya', name: 'Riya', userID: null, email: null, removedAt: '2026-10-01T00:00:00Z' }],
  syncState: 'synced', localOnly: false,
};
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour, 5).toISOString();
const NOW = new Date(2026, 10, 3, 15, 0).getTime();
const event = (seq: number, kind: ActivityEvent['kind'], actorID: string | null, data: Record<string, unknown>, day = 3, subjectID: string | null = null): ActivityEvent => ({ seq, groupID: 'g', actorID, kind, subjectID, data, at: at(day) });

describe('describeActivity', () => {
  test.each([
    ['Sam added Groceries', event(1, 'expense.added', 'sam', { merchant: 'Groceries', amountMinor: 3600 }), 'Austin Trip · $36.00 total', 'expenses'],
    ['You added Museum tickets', event(2, 'expense.added', 'me', { merchant: 'Museum tickets', amountMinor: 5400 }), 'Austin Trip · $54.00 total', 'expenses'],
    ['You edited Dinner at Uchi', event(3, 'expense.edited', 'me', { merchant: 'Dinner at Uchi', amountMinor: 16350, previousAmountMinor: 16000 }), 'Austin Trip · amount $160.00 to $163.50', 'expenses'],
    ['You edited Dinner', event(4, 'expense.edited', 'me', { merchant: 'Dinner', amountMinor: 16000, previousAmountMinor: 16000 }), 'Austin Trip · details changed', 'expenses'],
    ['Sam deleted Taxi', event(5, 'expense.deleted', 'sam', { merchant: 'Taxi', amountMinor: 5400 }), 'Austin Trip · $54.00', 'expenses'],
    ['Sam paid you', event(6, 'payment.recorded', 'sam', { fromID: 'sam', toID: 'me', amountMinor: 5450 }), 'Austin Trip · $54.50', 'payments'],
    ['You paid Sam', event(7, 'payment.recorded', 'me', { fromID: 'me', toID: 'sam', amountMinor: 1200 }), 'Austin Trip · $12.00', 'payments'],
    ['Sam joined Austin Trip', event(8, 'member.joined', 'sam', {}), 'Joined the group', 'groups'],
    ['Riya was removed from Austin Trip', event(9, 'member.removed', 'me', { name: 'Riya' }), 'By You', 'groups'],
    ['You created Austin Trip', event(10, 'group.created', 'me', { name: 'Austin Trip' }), 'New group', 'groups'],
  ] as const)('%s', (title, e, subtitle, filter) => {
    expect(describeActivity(e, group, NOW)).toMatchObject({ title, subtitle, filter });
  });

  test('someone who left is still named, and an unknown actor is "Someone"', () => {
    expect(describeActivity(event(1, 'expense.added', 'riya', { merchant: 'X', amountMinor: 100 }), group, NOW).title).toBe('Riya added X');
    expect(describeActivity(event(1, 'expense.added', null, { merchant: 'X', amountMinor: 100 }), group, NOW).title).toBe('Someone added X');
  });
});

describe('activityFeed', () => {
  const events = [
    event(1, 'expense.added', 'me', { merchant: 'A', amountMinor: 100 }, 1),
    event(2, 'payment.recorded', 'sam', { fromID: 'sam', toID: 'me', amountMinor: 100 }, 2),
    event(3, 'member.joined', 'sam', {}, 3),
    { ...event(4, 'expense.added', 'me', { merchant: 'B', amountMinor: 100 }), groupID: 'unknown-group' },
  ];

  test('is newest first, skips groups this device does not have, and can be filtered', () => {
    expect(activityFeed(events, [group], NOW).map((r) => r.seq)).toEqual([3, 2, 1]);
    expect(activityFeed(events, [group], NOW, 'payments').map((r) => r.seq)).toEqual([2]);
    expect(activityFeed(events, [group], NOW, 'groups').map((r) => r.seq)).toEqual([3]);
    expect(activityFeed(events, [group], NOW, 'expenses', 'g').map((r) => r.seq)).toEqual([1]);
  });

  test('days are Today, Yesterday, then the date, and consecutive rows share a heading', () => {
    expect(dayLabel(at(3), NOW)).toBe('Today');
    expect(dayLabel(at(2, 23), NOW)).toBe('Yesterday');
    expect(dayLabel(at(1), NOW)).toBe('Nov 1');
    const days = byDay(activityFeed([...events, event(5, 'expense.added', 'me', { merchant: 'C', amountMinor: 1 }, 3)], [group], NOW));
    expect(days.map((d) => [d.day, d.rows.length])).toEqual([['Today', 2], ['Yesterday', 1], ['Nov 1', 1]]);
  });
});

describe('expenseHistory', () => {
  test('lists what happened to one expense, newest first, in the design wording', () => {
    const events = [
      event(1, 'expense.added', 'me', { merchant: 'Dinner at Uchi', amountMinor: 16000 }, 3, 'e1'),
      event(2, 'expense.edited', 'me', { merchant: 'Dinner at Uchi', amountMinor: 16350, previousAmountMinor: 16000 }, 3, 'e1'),
      event(3, 'expense.added', 'sam', { merchant: 'Other', amountMinor: 1 }, 3, 'e2'),
    ];
    const lines = expenseHistory(events, 'e1', group);
    expect(lines.map((l) => l.text)).toEqual(['You edited the amount $160.00 to $163.50', 'You added this expense']);
    expect(lines[0]!.when).toBe('Nov 3, 2026, 12:05 PM');
  });
});

describe('times', () => {
  test('12-hour clock with minutes', () => {
    expect(timeOfDay(new Date(2026, 10, 3, 0, 7).getTime())).toBe('12:07 AM');
    expect(timeOfDay(new Date(2026, 10, 3, 12, 30).getTime())).toBe('12:30 PM');
    expect(timeOfDay(new Date(2026, 10, 3, 20, 42).getTime())).toBe('8:42 PM');
  });
});

describe('syncing the feed', () => {
  async function phone() {
    const clock = new TestClock();
    const server = new FakeServer(clock);
    const d = device(server, clock, 'Ada');
    const created = await d.actions.createGroup({ name: 'Flat', currencyCode: 'USD', members: [{ name: 'Ada' }], meIndex: 0 });
    return { server, d, groupId: created.id };
  }

  test('new events are stored, a second sync asks only for what is after the last one', async () => {
    const { server, d, groupId } = await phone();
    server.activityLog = [{ seq: 1, groupID: groupId, actorID: null, kind: 'group.created', subjectID: groupId, data: {}, at: '2026-11-03T10:00:00Z' }];

    await d.engine.sync();
    expect((await d.storage.listActivity()).map((e) => e.seq)).toEqual([1]);

    server.activityLog.push({ seq: 2, groupID: groupId, actorID: null, kind: 'group.archived', subjectID: groupId, data: {}, at: '2026-11-03T11:00:00Z' });
    await d.engine.sync();
    expect((await d.storage.listActivity()).map((e) => e.seq)).toEqual([1, 2]);
    expect(await d.storage.getMeta('activitySeq')).toBe('2');
  });

  test('deleting a local copy removes its events, and the events survive reopening the app', async () => {
    const { server, d, groupId } = await phone();
    server.activityLog = [{ seq: 1, groupID: groupId, actorID: null, kind: 'group.created', subjectID: groupId, data: {}, at: '2026-11-03T10:00:00Z' }];
    await d.engine.sync();
    const rows = new Map<string, StoredRow>();
    const driver: StorageDriver = {
      load: async () => [...rows.values()],
      commit: async (writes: StoredWrite[]) => {
        for (const w of writes) {
          const id = `${w.table}/${w.key}`;
          if (w.json === null) rows.delete(id);
          else rows.set(id, { table: w.table, key: w.key, json: w.json });
        }
      },
    };
    const first = await PersistentStorage.open(driver);
    await first.putActivity(await d.storage.listActivity());
    expect((await (await PersistentStorage.open(driver)).listActivity()).map((e) => e.seq)).toEqual([1]);

    await d.actions.deleteLocalGroup(groupId);
    expect(await d.storage.listActivity()).toEqual([]);
    await first.putGroup({ ...group, id: groupId });
    await first.deleteGroup(groupId);
    expect(await (await PersistentStorage.open(driver)).listActivity()).toEqual([]);
  });
});
