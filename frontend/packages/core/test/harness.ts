import { Actions, MemoryStorage, SyncEngine, type Session } from '../src';
import { FakeServer } from './fakeServer';

export { TestClock, TestRandom } from './support';
import { TestClock, TestRandom } from './support';

export interface Device {
  name: string;
  clock: TestClock;
  storage: MemoryStorage;
  engine: SyncEngine;
  actions: Actions;
  /** The access token this phone sends; null once signed out. */
  token: string | null;
}

/** Build a phone: its own storage, outbox and engine, sharing the test clock and the server. */
export function device(server: FakeServer, clock: TestClock, name: string, session: Session = server.signUp(name), storage = new MemoryStorage()): Device {
  const d = { name, clock, storage, token: session.accessToken } as Device;
  const api = server.api(() => d.token);
  const random = new TestRandom(name[0]!.toLowerCase());
  d.engine = new SyncEngine({ storage, api, clock, random });
  d.actions = new Actions({ storage, clock, random, notify: d.engine.notify });
  return d;
}

export const draft = (payerID: string, participants: string[], over: Partial<Parameters<Actions['saveExpense']>[1]> = {}) => ({
  merchant: 'Groceries', occurredAt: '2026-10-01T10:00:00Z', category: 'groceries', notes: '', amountMinor: 10000,
  payerID, method: 'equal' as const, participants, values: [] as string[], ...over,
});
