import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { orders, type Order } from "../db/schema";

export type CheckoutInput = {
  merchantId: string;
  orderReference: string;
  amount: number;
  currency: string;
};

export type CheckoutResult =
  | { kind: "created"; order: Order }
  | { kind: "existing"; order: Order }
  | { kind: "mismatch"; mismatchedFields: Array<"amount" | "currency"> };

// See design.md › Checkout idempotency.
// No transaction: the INSERT is atomic on its own, and the follow-up SELECT
// only reads fields that never change (design.md › Immutability rule).
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  // The unique constraint decides the race. A concurrent insert with the same
  // key blocks until the first commits, then sees the conflict and returns no row.
  // Never SELECT-then-INSERT: both requests would see nothing and both insert.
  const [created] = await db
    .insert(orders)
    .values(input)
    .onConflictDoNothing({ target: [orders.merchantId, orders.orderReference] })
    .returning();

  if (created) return { kind: "created", order: created };

  // A new statement, so under READ COMMITTED it sees the row the winner committed.
  const [existing] = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.merchantId, input.merchantId), eq(orders.orderReference, input.orderReference)),
    );

  // Orders are never deleted, so a conflicting row must still exist.
  if (!existing) throw new Error("Order vanished after insert conflict");

  const mismatchedFields: Array<"amount" | "currency"> = [];
  if (existing.amount !== input.amount) mismatchedFields.push("amount");
  if (existing.currency !== input.currency) mismatchedFields.push("currency");

  if (mismatchedFields.length > 0) return { kind: "mismatch", mismatchedFields };
  return { kind: "existing", order: existing };
}

export async function findOrder(id: string): Promise<Order | undefined> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  return order;
}
