import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// core must stay platform-neutral: no React, React Native, Expo or Node imports in src/.
const FORBIDDEN = /from\s+['"](react|react-native|expo[^'"]*|node:[^'"]*|fs|path|os|crypto|http|https|child_process)['"]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith('.ts') ? [full] : [];
  });
}

test('core src has no platform imports', () => {
  const offenders = files(join(__dirname, '../src')).filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
