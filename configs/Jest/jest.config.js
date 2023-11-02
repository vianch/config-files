const testPathIgnorePatterns = [
  "/node_modules/",
  "<rootDir>/dist",
  "<rootDir>/types",
].filter((path) => !!path);

module.exports = {
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.ts$",
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    "utils/*.ts",
    "!utils/index.ts",
    "utils/**/*.ts",
    "!utils/**/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 85,
      lines: 85,
    },
  },
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns,
  watchPathIgnorePatterns: [".js$"],
  coverageReporters: ["json", "lcov", "text", "clover"],
};
