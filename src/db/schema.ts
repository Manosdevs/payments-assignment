import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// See design.md › Data model.

// Declaration order is not used for ranking: allowed transitions live in
// domain/status.ts (design.md › Payment status model).
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "processing",
  "failed",
  "succeeded",
]);

export const eventOutcome = pgEnum("event_outcome", ["applied", "ignored"]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: text("merchant_id").notNull(),
    orderReference: text("order_reference").notNull(),
    // Minor units. Validation caps it at Number.MAX_SAFE_INTEGER, so number mode is exact.
    amount: bigint("amount", { mode: "number" }).notNull(),
    // Format (^[A-Z]{3}$) is checked in Zod only. See design.md › Data model › orders.
    currency: text("currency").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Arbitrates concurrent checkouts: INSERT … ON CONFLICT on this key.
    // See design.md › Checkout idempotency.
    unique("orders_merchant_id_order_reference_key").on(
      t.merchantId,
      t.orderReference,
    ),
    // A non-positive amount is a money bug wherever the row comes from.
    check("orders_amount_positive", sql`${t.amount} > 0`),
  ],
);

export const webhookEvents = pgTable("webhook_events", {
  // The provider's event ID is the dedup key: ON CONFLICT (event_id) DO NOTHING.
  // See design.md › Webhook processing › Duplicate detection.
  eventId: text("event_id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  status: paymentStatus("status").notNull(),
  // audit only, nothing should be reading this atm
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  outcome: eventOutcome("outcome").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof orders.$inferSelect;
