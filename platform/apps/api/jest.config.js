/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src"],
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", diagnostics: false }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/prisma$": "<rootDir>/prisma",
    "^@/shared$": "<rootDir>/../../../packages/shared/src",
    "^@keepr/sdk$": "<rootDir>/../../packages/sdk/src",
    "^@keepr/sdk/(.*)$": "<rootDir>/../../packages/sdk/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/**/*.module.ts", "!src/**/*.dto.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
};
