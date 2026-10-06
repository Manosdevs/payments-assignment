import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../logger";
import * as schema from "./schema";

// A request blocked on a row lock keeps its connection, so the pool size caps
// how many requests can really overlap in Postgres (tests use 20).
// See design.md › Testing strategy › Making overlap real.
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_SIZE });

// An idle client dropped by Postgres (restart, admin kill) is emitted here.
// Without a listener Node crashes the process; the pool has already discarded
// the client, so logging is enough. Errors on active queries still reject.
pool.on("error", (err) => {
  logger.error({ err }, "Idle database client error");
});

export const db = drizzle({ client: pool, schema });

// Resolved from this file, not the working directory: works from src/ (tsx, Jest) and dist/.
export const migrationsFolder = path.join(__dirname, "../../drizzle");
