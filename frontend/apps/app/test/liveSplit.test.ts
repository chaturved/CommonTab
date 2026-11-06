import { liveSplit } from '@/lib/liveSplit';

describe('liveSplit', () => {
  it('splits a bill equally and the shares add back to the total', () => {
    expect(liveSplit('163.50', 3)).toEqual({ total: 16350, shares: [5450, 5450, 5450] });
  });

  it('hands leftover cents to the first people', () => {
    const { total, shares } = liveSplit('100.00', 3);
    expect(shares).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('returns no shares for an empty, zero or invalid amount', () => {
    expect(liveSplit('', 3).shares).toEqual([]);
    expect(liveSplit('0', 3).shares).toEqual([]);
    expect(liveSplit('abc', 3).shares).toEqual([]);
    expect(liveSplit('1.234', 3).shares).toEqual([]);
  });
});
