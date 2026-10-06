import "dotenv/config";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Runs once before all test files: apply the same migration files a reviewer
// applies, to payments_test. Uses its own pool because src/db reads env at import.
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set to run the tests");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: path.join(__dirname, "../drizzle"),
    });
  } finally {
    await pool.end();
  }
}
