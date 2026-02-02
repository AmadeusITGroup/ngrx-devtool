module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/projects/ngrx-devtool-demo/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/projects/ngrx-devtool-ui/src/app/$1',
    '^@components/(.*)$': '<rootDir>/projects/ngrx-devtool-ui/src/components/$1',
    '^@services/(.*)$': '<rootDir>/projects/ngrx-devtool-ui/src/services/$1',
  },
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  collectCoverageFrom: [
    'projects/ngrx-devtool-ui/src/**/*.ts',
    'projects/ngrx-devtool/src/**/*.ts',
    '!**/*.module.ts',
    '!**/index.ts',
    '!**/public-api.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'text-summary'],
};
