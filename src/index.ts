import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createApp } from "./app";
import { env } from "./config/env";
import { db, migrationsFolder, pool } from "./db";
import { logger } from "./logger";

// Migrate, then listen: a reviewer only needs `docker compose up --build`.
// See design.md › Local setup. With several instances this would race;
// production would run migrations as a separate deploy step.
async function main() {
  await migrate(db, { migrationsFolder });
  logger.info("Migrations applied");

  const app = createApp();

  const server = app.listen(env.PORT, (error) => {
    if (error) throw error;
    logger.info({ port: env.PORT }, "Server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ err: error }, "Startup failed");
  process.exit(1);
});
