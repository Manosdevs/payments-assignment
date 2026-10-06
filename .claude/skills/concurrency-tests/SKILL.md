---
name: concurrency-tests
description: Use when writing or changing Jest integration tests in this repo, especially any test that sends overlapping requests (concurrent checkouts, duplicate webhook deliveries, race B). Covers the test harness, how to guarantee real overlap, what to assert in HTTP responses and the database, and the break-it check.
---

# Concurrency tests

The spec grades tests on whether they *support the claims*. A concurrency test that would also pass without the lock or constraint proves nothing. Reference: `docs/design.md` › Testing strategy, which lists every required test and its assertions.

## Harness

- Tests run against `TEST_DATABASE_URL` (`payments_test`), never the dev database.
- Jest `globalSetup` runs Drizzle's `migrate()` once.
- `beforeEach`: `TRUNCATE webhook_events, orders CASCADE`.
- Always `--runInBand`: test files share one database.
- Use `supertest` against the app from `src/app.ts`. For concurrent calls, start one server (`app.listen(0)`) in `beforeAll`, use `request(server)` for every call, and close it in `afterAll`.
- Pool size for tests: 20.
- Close the pool in `afterAll` so Jest exits.

## Making overlap real

1. **Fire requests together.** Build all request promises first, then `await Promise.all(...)`. Never `await` inside a loop.
2. **Pool ≥ concurrency.** 10 requests need at least 10 connections. Requests blocked on a row lock still hold their connection.
3. **Hold the lock.** For webhook races, set `TEST_TX_DELAY_MS` (for example 200) in the test environment so the first transaction sleeps after taking the order lock. The others are then guaranteed to arrive while it's held.
4. Checkout races don't need the delay: the unique index arbitrates regardless of timing.

```ts
const body = { merchant_id: 'm_1', order_reference: 'ORD-1', amount: 1999, currency: 'EUR' };
const responses = await Promise.all(
  Array.from({ length: 10 }, () => request(server).post('/orders').send(body)),
);
const statuses = responses.map((r) => r.status).sort();
expect(statuses.filter((s) => s === 201)).toHaveLength(1);
expect(statuses.filter((s) => s === 200)).toHaveLength(9);
expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
// then query the database directly: exactly one order row
```

## Assertions

Every test checks **both** the HTTP responses **and** the stored data, queried directly with SQL or Drizzle, not through the API.

- "Applied exactly once" is proven by **one `webhook_events` row** for that `event_id` with outcome `applied`. The order's status can't prove it, because applying `succeeded` twice still gives `succeeded`.
- "Rejected without change" means asserting the stored row is identical to before: amount, currency, status, one row.
- Stale or conflicting events: assert `200`, the order status unchanged, and the event row's `outcome` (or, for a same-ID conflict, that no new row exists and the stored row's status is the original).

## Break-it check (once, by hand)

After test 7 (race B) passes:

1. Replace `.for('no key update')` with a plain select in the webhook service.
2. Run test 7. It must **fail**. If it passes, the test isn't exercising the lock: increase the delay or the number of concurrent requests, and fix the test.
3. Restore the lock. Run it again: it must pass.
4. Record the result in the README.

Do the same for the checkout test by temporarily removing the unique constraint if time allows.
