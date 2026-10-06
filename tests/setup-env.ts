import "dotenv/config";

// Runs before each test file's imports, so src/config/env.ts sees these values.
// See design.md › Testing strategy › Environment.

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL must be set to run the tests");

// Tests TRUNCATE tables: never let them point at the dev database.
if (testUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
}

process.env.DATABASE_URL = testUrl;
// Pool ≥ concurrent requests, or requests queue in Node and never overlap in Postgres.
process.env.DB_POOL_SIZE = "20";
process.env.NODE_ENV = "test";
