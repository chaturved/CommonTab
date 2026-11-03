import { ApiError, HttpApi, PersistentStorage, type FetchLike, type LocalExpense, type StorageDriver, type StoredRow, type StoredWrite } from '../src';
import { FakeServer } from './fakeServer';
import { device, draft, TestClock } from './harness';

async function ada() {
  const clock = new TestClock();
  const server = new FakeServer(clock);
  const phone = device(server, clock, 'Ada');
  const group = await phone.actions.createGroup({ name: 'Flat', currencyCode: 'USD', members: [{ name: 'Ada' }, { name: 'Bob' }], meIndex: 0 });
  const [me, bob] = group.members.map((m) => m.id) as [string, string];
  await phone.actions.saveExpense(group.id, draft(me, [me, bob]));
  await phone.engine.sync();
  return { server, phone, groupId: group.id, me, bob };
}

describe('groups the server says you lost', () => {
  test('a removed group keeps its last copy, marked closed with the date', async () => {
    const w = await ada();
    w.server.closed.set(w.groupId, { status: 'removed', since: '2026-11-02T10:00:00Z' });

    await w.phone.engine.sync();

    const group = await w.phone.storage.getGroup(w.groupId);
    expect(group?.closed).toEqual({ status: 'removed', since: '2026-11-02T10:00:00Z' });
    expect(await w.phone.storage.listExpenses(w.groupId)).toHaveLength(1);
  });

  test('a deleted group is marked deleted, and a group this phone never had is ignored', async () => {
    const w = await ada();
    w.server.closed.set(w.groupId, { status: 'deleted', since: '2026-11-03T10:00:00Z' });
    w.server.closed.set('unknown-group', { status: 'removed', since: '2026-11-03T10:00:00Z' });

    await w.phone.engine.sync();

    expect((await w.phone.storage.getGroup(w.groupId))?.closed?.status).toBe('deleted');
    expect(await w.phone.storage.getGroup('unknown-group')).toBeUndefined();
  });

  test('being let back in clears the mark and brings the group up to date again', async () => {
    const w = await ada();
    w.server.closed.set(w.groupId, { status: 'removed', since: '2026-11-02T10:00:00Z' });
    await w.phone.engine.sync();
    w.server.closed.clear();

    await w.phone.engine.sync();

    expect((await w.phone.storage.getGroup(w.groupId))?.closed).toBeUndefined();
  });

  test('the archived flag follows the server', async () => {
    const w = await ada();
    expect((await w.phone.storage.getGroup(w.groupId))?.archived).toBe(false);
  });
});

describe('deleting a local copy', () => {
  test('removes the group, its expenses, payments and queued changes, and leaves other groups alone', async () => {
    const w = await ada();
    const other = await w.phone.actions.createGroup({ name: 'Trip', currencyCode: 'USD', members: [{ name: 'Ada' }], meIndex: 0 });
    await w.phone.actions.saveExpense(w.groupId, draft(w.me, [w.me, w.bob]));

    await w.phone.actions.deleteLocalGroup(w.groupId);

    expect(await w.phone.storage.getGroup(w.groupId)).toBeUndefined();
    expect(await w.phone.storage.listExpenses(w.groupId)).toEqual([]);
    expect((await w.phone.storage.listOutbox()).filter((e) => e.groupId === w.groupId)).toEqual([]);
    expect(await w.phone.storage.getGroup(other.id)).toBeDefined();
  });

  test('persists: after reopening the deleted group is still gone', async () => {
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
    await first.putGroup({ id: 'g', name: 'G', currencyCode: 'USD', ownerID: 'm', meMemberID: 'm', version: 1, members: [], syncState: 'synced', localOnly: false });
    await first.putExpense({ id: 'e', groupID: 'g', syncState: 'synced', history: [] } as unknown as LocalExpense);

    await first.deleteGroup('g');

    const second = await PersistentStorage.open(driver);
    expect(await second.getGroup('g')).toBeUndefined();
    expect(await second.listExpenses('g')).toEqual([]);
  });
});

describe('the new calls', () => {
  const api = (replies: { status: number; body?: unknown }[]) => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push(`${init.method} ${url.replace('https://api.test/v1', '')}`);
      const reply = replies.shift()!;
      return { status: reply.status, headers: { get: () => null }, text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)) };
    };
    return { calls, api: new HttpApi({ baseUrl: 'https://api.test', fetch, getToken: () => 't' }) };
  };

  test('each one goes to its route', async () => {
    const { api: http, calls } = api([{ status: 204 }, { status: 204 }, { status: 204 }, { status: 204 }, { status: 204 }]);
    await http.leaveGroup('g');
    await http.removeMember('g', 'm');
    await http.archiveGroup('g');
    await http.unarchiveGroup('g');
    await http.deleteGroup('g');
    expect(calls).toEqual(['POST /groups/g/leave', 'DELETE /groups/g/members/m', 'POST /groups/g/archive', 'POST /groups/g/unarchive', 'DELETE /groups/g']);
  });

  test('leaving while you owe says how much', async () => {
    const { api: http } = api([{ status: 409, body: { detail: 'Settle up before leaving', code: 'owes_balance', balanceMinor: -1800 } }]);
    const error = await http.leaveGroup('g').catch((e: unknown) => e as ApiError);
    expect(error).toMatchObject({ status: 409, code: 'owes_balance', balanceMinor: -1800 });
  });
});
