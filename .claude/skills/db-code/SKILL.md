---
name: db-code
description: Use when writing or changing any database code in this repo — Drizzle schema, migrations, queries, transactions, the checkout insert, or the webhook transaction. Gives the exact patterns the design requires and the mistakes that break correctness under concurrency.
---

# Database code

Every correctness guarantee in this service comes from Postgres constraints, row locks and transactions. Most bugs here don't show up in a single request; they show up when two requests overlap. Follow these patterns exactly. Reference: `docs/design.md` › Checkout idempotency, Webhook processing, Concurrency control.

## Schema and migrations

- Schema lives in `src/db/schema.ts`. Enums: `payment_status` (`pending`, `processing`, `failed`, `succeeded`) and `event_outcome` (`applied`, `ignored`).
- `amount`: `bigint('amount', { mode: 'number' })`.
- `orders.id`: `uuid` with `defaultRandom()` (`gen_random_uuid()`).
- `UNIQUE (merchant_id, order_reference)` on `orders`; `event_id` is the primary key of `webhook_events`; `webhook_events.order_id` references `orders.id`.
- Generate migrations with `npx drizzle-kit generate`. **Read the SQL it produces** and check every constraint is present before applying.
- Never edit a migration that has been applied anywhere. Generate a new one.
- If Drizzle can't express something, write it as a custom migration in SQL and comment why.

## Checkout pattern (no transaction)

```ts
const [created] = await db
  .insert(orders)
  .values(input)
  .onConflictDoNothing({ target: [orders.merchantId, orders.orderReference] })
  .returning();
if (created) return { kind: 'created', order: created };          // 201

const [existing] = await db
  .select()
  .from(orders)
  .where(and(eq(orders.merchantId, input.merchantId), eq(orders.orderReference, input.orderReference)));
// compare amount and currency → 'replay' (200) or 'mismatch' (409) with the differing fields
```

Why no transaction: no rule spans the two statements, and the compared fields never change.

## Webhook pattern (one transaction, lock first)

```ts
const result = await db.transaction(async (tx) => {
  // See design.md › Concurrency control: NO KEY UPDATE, never FOR UPDATE or a plain select
  const [order] = await tx.select().from(orders).where(eq(orders.id, evt.orderId)).for('no key update');
  if (!order) return { kind: 'unknown_order' } as const;          // 404 after the callback

  if (config.testTxDelayMs) await sleep(config.testTxDelayMs);   // test-only: guarantees overlap

  const outcome = canTransition(order.status, evt.status) ? 'applied' : 'ignored';

  const [inserted] = await tx
    .insert(webhookEvents)
    .values({ ...evt, outcome })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning();

  if (!inserted) {
    const [stored] = await tx.select().from(webhookEvents).where(eq(webhookEvents.eventId, evt.eventId));
    const same = stored.orderId === evt.orderId && stored.status === evt.status;
    return { kind: same ? 'duplicate' : 'conflicting_duplicate' } as const; // both 200; log the conflict
  }

  if (outcome === 'applied') {
    await tx.update(orders).set({ status: evt.status, updatedAt: sql`now()` }).where(eq(orders.id, evt.orderId));
  }
  return { kind: outcome } as const;
});
// Only now has the transaction committed. Map result.kind to the HTTP response here.
```

Confirm `.for('no key update')` exists in the pinned Drizzle version. If it doesn't, use a `sql` fragment and leave a comment.

## Rules

- **Never respond inside the transaction callback.** Return a result; respond after `await db.transaction(...)` resolves. That is what makes "2xx only after COMMIT" true.
- **Never catch and swallow errors inside the callback.** A thrown error must roll back the whole transaction and reach the error handler as a `500`.
- **Never read a status and then write it without the lock** taken by the same transaction.
- **Never split the event insert and the order update** into separate transactions or separate `db` calls outside `tx`.
- **Use `tx`, not `db`, inside the callback.** A query on `db` runs on a different connection, outside the transaction.
- **Don't change the isolation level.** READ COMMITTED is what makes the blocked locking select re-read the latest committed row.
- **Validate UUIDs before querying.** An invalid value makes Postgres throw, which surfaces as a `500`.
