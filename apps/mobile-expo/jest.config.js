/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  moduleNameMapper: {
    '^@fieldsolo/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    '^@fieldsolo/document-renderer$': '<rootDir>/../../packages/document-renderer/src/index.ts',
    '^@fieldsolo/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@fieldsolo/design-system/(.*)$': '<rootDir>/../../packages/design-system/$1',
    '^@fieldsolo/design-system$': '<rootDir>/../../packages/design-system/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|standard-navigation|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-safe-area-context|react-native-svg))',
  ],
};
