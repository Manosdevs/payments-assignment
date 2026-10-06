import type { Server } from "node:http";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db";

// One real server per test file: concurrent supertest calls against the same
// listening server, each on its own HTTP connection.
export async function startServer(): Promise<Server> {
  await warmPool();
  return new Promise((resolve) => {
    const server = createApp().listen(0, () => resolve(server));
  });
}

// Open every pool connection up front. On a cold pool each request first does
// a connection handshake; those finish one at a time, so the first request can
// complete before the others reach Postgres and a race test passes by luck.
// Found by the break-it check (select-then-insert passed test 1 on a cold pool).
async function warmPool(): Promise<void> {
  const clients = await Promise.all(Array.from({ length: pool.options.max }, () => pool.connect()));
  for (const client of clients) client.release();
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await pool.end(); // or Jest never exits
}

// Real commits are needed for concurrency, so tests can't roll back a
// per-test transaction; truncate instead (with --runInBand).
export async function resetDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE webhook_events, orders CASCADE`);
}
