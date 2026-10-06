import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  // Only the test setup reads it; the app always connects to DATABASE_URL.
  TEST_DATABASE_URL: z.url().optional(),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  // Test-only: the webhook handler sleeps this long while holding the order
  // row lock, so concurrent requests are guaranteed to overlap.
  // See design.md › Testing strategy › Making overlap real.
  TEST_TX_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.prettifyError(parsed.error));
  process.exit(1);
}

// The delay holds a row lock open on purpose; it must never reach a real deployment.
if (parsed.data.TEST_TX_DELAY_MS !== undefined && parsed.data.NODE_ENV !== "test") {
  console.error("TEST_TX_DELAY_MS is test-only and must not be set when NODE_ENV is not 'test'");
  process.exit(1);
}

export const env = parsed.data;
