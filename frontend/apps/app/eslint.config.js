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
  { ignores: ['dist/*', '.expo/*'] },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      ...Object.fromEntries(compilerRules.map((rule) => [rule, 'warn'])),
    },
  },
]);
