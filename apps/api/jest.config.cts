module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  transformIgnorePatterns: ['/node_modules/(?!@nestjs/config/)'],
  moduleNameMapper: {
    '^@cheapest-mt/db$': '<rootDir>/../db/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
};
