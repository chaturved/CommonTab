import { readFileSync } from 'fs';
import { join } from 'path';

export interface FixtureCase<I = any, E = any> {
  name: string;
  input: I;
  expect?: E;
  error?: true;
}

export function loadFixture<I = any, E = any>(file: string): FixtureCase<I, E>[] {
  return JSON.parse(readFileSync(join(__dirname, '../../../../fixtures/money', file), 'utf8'));
}
