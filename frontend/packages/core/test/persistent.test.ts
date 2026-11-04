import { PersistentStorage, type StorageDriver, type StoredRow, type StoredWrite } from '../src';

class FakeDriver implements StorageDriver {
  rows = new Map<string, StoredRow>();
  failNext = false;
  load = async () => [...this.rows.values()];
  commit = async (writes: StoredWrite[]) => {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('disk full');
    }
    for (const w of writes) {
      const id = `${w.table}/${w.key}`;
      if (w.json === null) this.rows.delete(id);
      else this.rows.set(id, { table: w.table, key: w.key, json: w.json });
    }
  };
}

const group = (id: string) => ({ id, name: 'Trip', currencyCode: 'USD', ownerID: 'm', meMemberID: 'm', version: null, members: [], syncState: 'pending' as const, localOnly: false });
const entry = (opId: string) => ({ opId, seq: 1 } as never);

describe('PersistentStorage', () => {
  test('what is committed is there after reopening on the same driver', async () => {
    const driver = new FakeDriver();
    const first = await PersistentStorage.open(driver);
    await first.transaction(async (tx) => {
      await tx.putGroup(group('g1'));
      await tx.setMeta('lastSyncedAt', '5');
      await tx.putOutbox(entry('op1'));
    });
    const second = await PersistentStorage.open(driver);
    expect((await second.getGroup('g1'))?.name).toBe('Trip');
    expect(await second.getMeta('lastSyncedAt')).toBe('5');
    expect((await second.listOutbox()).map((e) => e.opId)).toEqual(['op1']);
  });

  test('deletes are persisted', async () => {
    const driver = new FakeDriver();
    const storage = await PersistentStorage.open(driver);
    await storage.putOutbox(entry('op1'));
    await storage.deleteOutbox('op1');
    expect((await PersistentStorage.open(driver)).listOutbox()).resolves.toEqual([]);
  });

  test('a failed commit changes neither the disk nor what reads see', async () => {
    const driver = new FakeDriver();
    const storage = await PersistentStorage.open(driver);
    await storage.putGroup(group('g1'));
    driver.failNext = true;
    await expect(storage.transaction(async (tx) => {
      await tx.putGroup(group('g2'));
      await tx.putOutbox(entry('op1'));
    })).rejects.toThrow('disk full');
    expect((await storage.listGroups()).map((g) => g.id)).toEqual(['g1']);
    expect(await storage.listOutbox()).toEqual([]);
    expect(driver.rows.size).toBe(1);
  });

  test('an error inside the transaction writes nothing', async () => {
    const driver = new FakeDriver();
    const storage = await PersistentStorage.open(driver);
    await expect(storage.transaction(async (tx) => {
      await tx.putGroup(group('g1'));
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(driver.rows.size).toBe(0);
    expect(await storage.listGroups()).toEqual([]);
  });
});
