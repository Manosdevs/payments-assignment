import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../logger";
import { db, migrationsFolder, pool } from "./index";

// Standalone `npm run db:migrate`. The server also migrates on startup (see src/index.ts).
async function main() {
  try {
    await migrate(db, { migrationsFolder });
    logger.info("Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Migration failed");
  process.exit(1);
});
