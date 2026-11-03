import { convertMinorUnits, CoreError } from '../src';
import { loadFixture } from './fixtures';

interface Input { original: number; from: string; to: string; rateMicros: number }

describe('shared fixtures: convert.json', () => {
  test.each(loadFixture<Input, number>('convert.json').map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { original, from, to, rateMicros } = c.input;
    if (c.error) expect(() => convertMinorUnits(original, from, to, rateMicros)).toThrow(CoreError);
    else expect(convertMinorUnits(original, from, to, rateMicros)).toBe(c.expect);
  });

  test('an unknown currency is refused', () => {
    expect(() => convertMinorUnits(100, 'usd', 'EUR', 1_000_000)).toThrow(CoreError);
  });
});
