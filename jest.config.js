/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/global-setup.ts",
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  testTimeout: 15000,
};
