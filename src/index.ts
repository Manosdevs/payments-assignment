import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db";

const app = createApp();

const server = app.listen(env.PORT, (error) => {
  if (error) throw error;
  console.log(`Server listening on port ${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
