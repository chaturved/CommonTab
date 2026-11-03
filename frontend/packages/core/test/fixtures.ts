import { readFileSync } from 'fs';
import { join } from 'path';

export interface FixtureCase<I = any, E = any> {
  name: string;
  input: I;
  expect?: E;
  error?: true;
}

/** Load a shared fixture file from <repo>/fixtures/money. The backend tests read the same files. */
export function loadFixture<I = any, E = any>(file: string): FixtureCase<I, E>[] {
  return JSON.parse(readFileSync(join(__dirname, '../../../../fixtures/money', file), 'utf8'));
}
