const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

const compilerRules = [
  'react-hooks/purity',
  'react-hooks/refs',
  'react-hooks/set-state-in-effect',
  'react-hooks/immutability',
  'react-hooks/use-memo',
  'react-hooks/preserve-manual-memoization',
];

module.exports = defineConfig([
  expo,
  { ignores: ['**/dist/*', '**/.expo/*', '**/node_modules/*'] },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      ...Object.fromEntries(compilerRules.map((rule) => [rule, 'warn'])),
    },
  },
  {
    files: ['apps/app/**/*.{ts,tsx}'],
    settings: {
      'import/resolver': { typescript: { project: 'apps/app/tsconfig.json' } },
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-*', 'react/*', 'expo', 'expo-*', 'node:*', 'fs', 'path'] }],
    },
  },
  {
    files: ['packages/core/test/**/*.ts'],
    rules: { 'expo/no-dynamic-env-var': 'off' },
  },
]);
