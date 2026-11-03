import { Balance, computeBalances, CoreError, LedgerInput, simplifyDebts, Transfer } from '../src';
import { loadFixture } from './fixtures';

describe('shared fixtures: ledger.json', () => {
  test.each(loadFixture<LedgerInput, Balance[]>('ledger.json').map((c) => [c.name, c] as const))('%s', (_name, c) => {
    if (c.error) {
      expect(() => computeBalances(c.input)).toThrow(CoreError);
    } else {
      const balances = computeBalances(c.input);
      expect(balances).toEqual(c.expect);
      expect(balances.reduce((s, b) => s + b.minorUnits, 0)).toBe(0);
    }
  });
});

describe('computeBalances', () => {
  const split = (amount: number, payerID: string, ids: string[]) => ({
    id: `e-${amount}`,
    amount,
    payerID,
    allocations: ids.map((memberID, i) => ({ memberID, minorUnits: Math.floor(amount / ids.length) + (i < amount % ids.length ? 1 : 0) })),
  });

  test('a deleted expense (tombstone) no longer counts', () => {
    const kept = split(1001, 'a', ['a', 'b', 'c']);
    const gone = { ...split(5000, 'b', ['a', 'b', 'c']), deletedAt: '2026-11-02T10:00:00Z' };
    const balances = computeBalances({ members: ['a', 'b', 'c'], expenses: [kept, gone], settlements: [] });
    expect(balances.map((b) => b.minorUnits)).toEqual([667, -334, -333]);
  });

  test('result follows member order, not expense order', () => {
    const balances = computeBalances({ members: ['c', 'b', 'a'], expenses: [split(300, 'a', ['a', 'b', 'c'])], settlements: [] });
    expect(balances.map((b) => b.memberID)).toEqual(['c', 'b', 'a']);
    expect(balances.map((b) => b.minorUnits)).toEqual([-100, -100, 200]);
  });

  test('duplicate members are rejected', () =>
    expect(() => computeBalances({ members: ['a', 'a'], expenses: [], settlements: [] })).toThrow(CoreError));

  test('negative allocation is rejected', () =>
    expect(() =>
      computeBalances({
        members: ['a', 'b'],
        expenses: [{ id: 'e', amount: 100, payerID: 'a', allocations: [{ memberID: 'a', minorUnits: 200 }, { memberID: 'b', minorUnits: -100 }] }],
        settlements: [],
      })).toThrow(CoreError));
});

describe('shared fixtures: simplify.json', () => {
  test.each(loadFixture<Balance[], Transfer[]>('simplify.json').map((c) => [c.name, c] as const))('%s', (_name, c) => {
    if (c.error) expect(() => simplifyDebts(c.input)).toThrow(CoreError);
    else expect(simplifyDebts(c.input)).toEqual(c.expect);
  });
});

describe('simplifyDebts properties', () => {
  let seed = 98765;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };

  test('everyone ends with the same net balance, with at most (people owing or owed - 1) payments', () => {
    for (let i = 0; i < 500; i++) {
      const count = 2 + next(9);
      const values = Array.from({ length: count - 1 }, () => next(20001) - 10000);
      values.push(-values.reduce((a, b) => a + b, 0));
      const balances = values.map((minorUnits, k) => ({ memberID: `m${k}`, minorUnits }));
      const transfers = simplifyDebts(balances);

      const net = new Map(balances.map((b) => [b.memberID, 0]));
      for (const t of transfers) {
        expect(t.minorUnits).toBeGreaterThan(0);
        expect(t.fromID).not.toBe(t.toID);
        net.set(t.fromID, (net.get(t.fromID) as number) + t.minorUnits);
        net.set(t.toID, (net.get(t.toID) as number) - t.minorUnits);
      }
      // Paying `t` raises the payer's balance, so after all payments everyone is at zero.
      balances.forEach((b) => expect(b.minorUnits + (net.get(b.memberID) as number)).toBe(0));
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, balances.filter((b) => b.minorUnits !== 0).length - 1));
    }
  });

  test('same input, same output', () => {
    const balances = [{ memberID: 'a', minorUnits: 300 }, { memberID: 'b', minorUnits: -100 }, { memberID: 'c', minorUnits: -200 }];
    expect(simplifyDebts(balances)).toEqual(simplifyDebts([...balances]));
  });
});
