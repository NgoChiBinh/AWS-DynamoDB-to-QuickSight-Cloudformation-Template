module.exports = {
    // setupFiles: ['<rootDir>/tests/setEnvVars.js'],
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/unit_test/**/*.[tj]s?(x)'],
    collectCoverage: true,
    coverageDirectory: 'coverage-nuoa',
    collectCoverageFrom: [
      'src/lib/*.ts',
      'src/lambda-code/**/*js'
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: -10
      },
    },
  };