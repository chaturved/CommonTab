/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false, tsconfig: { module: 'commonjs', target: 'es2022', esModuleInterop: true, strict: true } }],
  },
};
