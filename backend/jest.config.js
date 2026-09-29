/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { strict: false },
    }],
  },
  setupFiles: ['dotenv/config'], // load backend/.env before tests
  testEnvironment: 'node',
  testTimeout: 30000,
};

