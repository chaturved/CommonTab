import {
  allocateProportionally,
  CoreError,
  formatMinorUnits,
  fractionDigits,
  parseMinorUnits,
  sumMinorUnits,
} from '../src';

describe('fractionDigits', () => {
  test.each([
    ['USD', 2],
    ['EUR', 2],
    ['JPY', 0],
    ['KWD', 3],
  ])('%s has %i digits', (code, digits) => expect(fractionDigits(code)).toBe(digits));

  test.each(['usd', 'US', 'USDX', '', 'U$D'])('rejects %p', (code) => expect(fractionDigits(code)).toBeUndefined());
});

describe('parseMinorUnits', () => {
  test.each([
    ['10.01', 'USD', 1001],
    ['10', 'USD', 1000],
    ['0.5', 'USD', 50],
    ['10.50', 'USD', 1050],
    ['10.000', 'USD', 1000],
    ['123', 'JPY', 123],
    ['1.234', 'KWD', 1234],
    ['  7.25 ', 'USD', 725],
    ['1000000000', 'USD', 100_000_000_000],
  ])('%s %s -> %i', (text, code, units) => expect(parseMinorUnits(text, code)).toBe(units));

  test.each([
    ['123.45', 'JPY'], // Swift golden: no minor units in yen
    ['10.001', 'USD'],
    ['-5', 'USD'],
    ['+5', 'USD'],
    ['1e3', 'USD'],
    ['1,000', 'USD'],
    ['', 'USD'],
    ['.5', 'USD'],
    ['1000000000.01', 'USD'],
    ['5', 'usd'],
  ])('rejects %p in %s', (text, code) => expect(() => parseMinorUnits(text, code)).toThrow(CoreError));

  test('stays exact where floats would not', () => {
    expect(parseMinorUnits('0.29', 'USD')).toBe(29);
    expect(parseMinorUnits('1.15', 'USD')).toBe(115);
    expect(parseMinorUnits('4.35', 'USD')).toBe(435);
  });
});

describe('formatMinorUnits', () => {
  test.each([
    [1001, 'USD', '10.01'],
    [5, 'USD', '0.05'],
    [0, 'USD', '0.00'],
    [123, 'JPY', '123'],
    [1234, 'KWD', '1.234'],
  ])('%i %s -> %s', (units, code, text) => expect(formatMinorUnits(units, code)).toBe(text));

  test('round-trips with parse', () => {
    for (const units of [0, 1, 99, 100, 1001, 99_999_999_999]) {
      expect(parseMinorUnits(formatMinorUnits(units, 'USD'), 'USD')).toBe(units);
    }
  });

  test.each([-1, 1.5, NaN, Infinity, 2 ** 53])('rejects %p', (units) =>
    expect(() => formatMinorUnits(units, 'USD')).toThrow(CoreError));
});

describe('sumMinorUnits', () => {
  test('adds', () => expect(sumMinorUnits([1, 2, 3])).toBe(6));
  test('detects overflow', () => expect(() => sumMinorUnits([Number.MAX_SAFE_INTEGER, 1])).toThrow(CoreError));
});

describe('allocateProportionally', () => {
  const alloc = (amount: number, weights: number[]) =>
    allocateProportionally(BigInt(amount), weights.map(BigInt)).map(Number);

  test('sums to the amount and favors the largest remainder', () => {
    expect(alloc(99, [334, 334, 333])).toEqual([33, 33, 33]);
    expect(alloc(150, [334, 334, 333])).toEqual([50, 50, 50]);
  });
  test('ties go to the lower index', () => expect(alloc(100, [7, 1])).toEqual([88, 12]));
  test('zero amount', () => expect(alloc(0, [1, 2])).toEqual([0, 0]));
  test('rejects zero total weight', () => expect(() => alloc(5, [0, 0])).toThrow(CoreError));
  test('no precision loss above 2^53', () => {
    const shares = allocateProportionally(9_007_199_254_740_993n, [1n, 1n, 1n]);
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(9_007_199_254_740_993n);
  });
});
