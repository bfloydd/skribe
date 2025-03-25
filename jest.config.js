module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    // Add any path aliases if needed
  },
  // Mock Obsidian's dependencies that are not available in tests
  moduleNameMapper: {
    "obsidian": "<rootDir>/src/tests/mocks/obsidianMock.ts"
  }
}; 