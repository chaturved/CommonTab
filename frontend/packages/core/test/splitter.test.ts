import { allocate, CoreError, splitByItem, sumMinorUnits } from '../src';
import { loadFixture } from './fixtures';

describe.each(['equal.json', 'exact.json', 'percent.json'])('shared fixtures: %s', (file) => {
  test.each(loadFixture(file).map((c) => [c.name, c] as const))('%s', (_name, c) => {
    if (c.error) {
      expect(() => allocate(c.input)).toThrow(CoreError);
    } else {
      const result = allocate(c.input);
      expect(result).toEqual(c.expect);
      expect(sumMinorUnits(result.map((a) => a.minorUnits))).toBe(c.input.amount);
    }
  });
});

describe('shared fixtures: by_item.json', () => {
  test.each(loadFixture('by_item.json').map((c) => [c.name, c] as const))('%s', (_name, c) => {
    if (c.error) {
      expect(() => splitByItem(c.input)).toThrow(CoreError);
    } else {
      const result = splitByItem(c.input);
      expect(result).toEqual(c.expect);
      expect(sumMinorUnits(result.shares.map((s) => s.total))).toBe(result.total);
    }
  });
});

describe('allocate: rules the shared fixtures cannot express', () => {
  const people = ['a', 'b', 'c'];
  test('SPEC: $100.00 split 3 ways is 33.34 / 33.33 / 33.33', () => {
    expect(allocate({ method: 'equal', amount: 10000, participants: people }).map((a) => a.minorUnits)).toEqual([3334, 3333, 3333]);
  });
  test('rejects zero amount', () => expect(() => allocate({ method: 'equal', amount: 0, participants: people })).toThrow(CoreError));
  test.each([-1, 1.5, NaN, 2 ** 53])('rejects amount %p', (amount) =>
    expect(() => allocate({ method: 'equal', amount, participants: people })).toThrow(CoreError));
  test('rejects nobody, duplicates and more than 20', () => {
    expect(() => allocate({ method: 'equal', amount: 100, participants: [] })).toThrow(CoreError);
    expect(() => allocate({ method: 'equal', amount: 100, participants: ['a', 'a'] })).toThrow(CoreError);
    const many = Array.from({ length: 21 }, (_, i) => `m${i}`);
    expect(() => allocate({ method: 'equal', amount: 100, participants: many })).toThrow(CoreError);
  });
  test('rejects a missing or extra value', () => {
    expect(() => allocate({ method: 'exact', amount: 100, participants: people, values: ['50', '50'] })).toThrow(CoreError);
    expect(() => allocate({ method: 'percent', amount: 100, participants: people, values: ['50', '50', '0', '0'] })).toThrow(CoreError);
  });
  test('percent accepts any number of decimals without float drift', () => {
    const result = allocate({ method: 'percent', amount: 1_000_000_007, participants: people, values: ['33.3333333', '33.3333333', '33.3333334'] });
    expect(sumMinorUnits(result.map((a) => a.minorUnits))).toBe(1_000_000_007);
  });
});

describe('property: shares always add up', () => {
  // Small deterministic generator so failures reproduce.
  let seed = 12345;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };

  test('equal splits differ by at most one cent and add up', () => {
    for (let i = 0; i < 500; i++) {
      const count = 1 + next(20);
      const amount = 1 + next(10_000_000);
      const ids = Array.from({ length: count }, (_, k) => `m${k}`);
      const units = allocate({ method: 'equal', amount, participants: ids }).map((a) => a.minorUnits);
      expect(sumMinorUnits(units)).toBe(amount);
      expect(Math.max(...units) - Math.min(...units)).toBeLessThanOrEqual(1);
    }
  });

  test('percent splits add up and stay within one cent of the exact share', () => {
    for (let i = 0; i < 500; i++) {
      const count = 2 + next(8);
      const amount = 1 + next(10_000_000);
      // random percentages in hundredths that total exactly 100.00
      const cuts = Array.from({ length: count - 1 }, () => next(10001)).sort((a, b) => a - b);
      const parts = [...cuts, 10000].map((cut, k) => cut - (k === 0 ? 0 : (cuts[k - 1] as number)));
      const values = parts.map((p) => `${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`);
      const ids = parts.map((_, k) => `m${k}`);
      const units = allocate({ method: 'percent', amount, participants: ids, values }).map((a) => a.minorUnits);
      expect(sumMinorUnits(units)).toBe(amount);
      units.forEach((u, k) => expect(Math.abs(u - (amount * (parts[k] as number)) / 10000)).toBeLessThan(1));
    }
  });

  test('itemized shares add up to the bill total', () => {
    for (let i = 0; i < 300; i++) {
      const people = Array.from({ length: 1 + next(6) }, (_, k) => `p${k}`);
      const items = Array.from({ length: 1 + next(8) }, (_, k) => ({
        name: `item${k}`,
        priceCents: next(20000),
        assignedTo: people.filter((_, idx) => idx === next(people.length) || next(3) === 0).concat(people[next(people.length)] as string),
      }));
      const result = splitByItem({ people, items, taxCents: next(5000), tipPercent: `${next(31)}.${next(100)}` });
      expect(sumMinorUnits(result.shares.map((s) => s.total))).toBe(result.total);
      expect(sumMinorUnits(result.shares.map((s) => s.tax))).toBe(result.tax);
      expect(sumMinorUnits(result.shares.map((s) => s.tip))).toBe(result.tip);
      expect(sumMinorUnits(result.shares.map((s) => s.subtotal))).toBe(result.subtotal);
    }
  });
});
