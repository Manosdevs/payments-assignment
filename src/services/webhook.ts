import { setTimeout as sleep } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../db";
import { orders, webhookEvents } from "../db/schema";
import { canTransition, type PaymentStatus } from "../domain/status";

export type WebhookInput = {
  eventId: string;
  orderId: string;
  status: PaymentStatus; // already mapped from the provider's vocabulary
  occurredAt: Date;
};

export type WebhookResult =
  | { kind: "unknown_order" }
  | { kind: "applied" | "ignored"; from: PaymentStatus }
  | { kind: "duplicate" }
  | { kind: "conflicting_duplicate"; stored: { orderId: string; status: PaymentStatus } };

// See design.md › Webhook processing and › Concurrency control.
// One transaction at READ COMMITTED (the default; don't raise it). The caller
// responds only after this promise resolves, i.e. after COMMIT.
export async function processWebhook(evt: WebhookInput): Promise<WebhookResult> {
  return db.transaction(async (tx) => {
    // 1. Lock the order row first. NO KEY UPDATE, never FOR UPDATE (it conflicts
    //    with the FK's KEY SHARE lock) and never a plain SELECT (two webhooks
    //    would both read the old status and the last write would win).
    //    A blocked caller gets the latest committed row once the lock is granted.
    const [order] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, evt.orderId))
      .for("no key update");

    // Nothing written yet; returning ends the transaction. 404 after the callback.
    if (!order) return { kind: "unknown_order" };

    // Test-only: hold the lock so concurrent webhooks are guaranteed to overlap.
    // config/env.ts refuses to start with this set outside NODE_ENV=test.
    if (env.TEST_TX_DELAY_MS) await sleep(env.TEST_TX_DELAY_MS);

    // 2. Decide before inserting. Safe even if this turns out to be a duplicate:
    //    the decision has no effect unless the insert succeeds, and the status
    //    can't change while we hold the lock.
    const outcome = canTransition(order.status, evt.status) ? "applied" : "ignored";

    // 3. Record the event once, with its final outcome. The event_id primary
    //    key decides duplicates.
    const [inserted] = await tx
      .insert(webhookEvents)
      .values({ ...evt, outcome })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ eventId: webhookEvents.eventId });

    if (!inserted) {
      // Duplicate delivery: compare only the fields that change what we do.
      const [stored] = await tx
        .select({ orderId: webhookEvents.orderId, status: webhookEvents.status })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, evt.eventId));
      if (!stored) throw new Error("Webhook event vanished after insert conflict");

      const same = stored.orderId === evt.orderId && stored.status === evt.status;
      return same ? { kind: "duplicate" } : { kind: "conflicting_duplicate", stored };
    }

    // 4. Same transaction as the event insert: both commit or neither does.
    if (outcome === "applied") {
      await tx
        .update(orders)
        .set({ status: evt.status, updatedAt: sql`now()` })
        .where(eq(orders.id, evt.orderId));
    }

    return { kind: outcome, from: order.status };
  });
}
