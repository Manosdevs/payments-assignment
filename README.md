# payments-assignment

Checkout backend: creates orders from checkout intents and applies payment-provider webhooks, correctly under retries, concurrency and out-of-order events. Postgres decides every race. Full design: [docs/design.md](docs/design.md).

TypeScript · Express 5 · Zod · PostgreSQL 17 · Drizzle · Jest · Docker

## Setup

Needs only Docker.

```bash
cp .env.example .env
docker compose up --build              # Postgres + migrations + API on :3000
docker compose run --rm app npm test   # tests, against a separate payments_test DB
docker compose down -v                 # reset (deletes the DB volume)
```

On the host (Node 24): `npm install`, `npm run db:up` (Postgres only), `npm run dev`, `npm test`.

**Config** (`.env.example`): `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `DB_POOL_SIZE`.
**Migrations** ([drizzle/](drizzle/)) apply automatically on startup and before tests. `npm run db:generate` creates one from [schema.ts](src/db/schema.ts).

## Calling the API

```bash
curl -X POST localhost:3000/orders -H 'Content-Type: application/json' \
  -d '{"merchant_id":"m_123","order_reference":"ORD-1001","amount":1999,"currency":"EUR"}'
curl localhost:3000/orders/<order_id>
scripts/send-webhook.sh <order_id> succeeded [event_id]   # simulate the provider
```

[request.http](request.http) (VS Code REST Client) walks through every endpoint and case.

## API

| Endpoint | Body | Responses |
| --- | --- | --- |
| `POST /orders` | `merchant_id`, `order_reference` (1–255 chars), `amount` (positive integer, minor units), `currency` (`^[A-Z]{3}$`) | `201` new · `200` matching retry · `409` same reference, different amount/currency · `400` |
| `GET /orders/:id` | | `200` · `404` |
| `POST /webhooks/payments` | `event_id` (1–255 chars), `order_id` (UUID), `status` (`processing`/`succeeded`/`failed`), `occurred_at` (ISO 8601) | `200` applied, ignored or duplicate · `400` · `404` unknown order · `500` |

Orders are returned as `{ id, merchant_id, order_reference, amount, currency, status, created_at, updated_at }`. Webhook `200`s return `{ "received": true }`. Errors return `{ "error": { code, message, details } }`.

## Data model

- **`orders`**: `UNIQUE (merchant_id, order_reference)`, `CHECK (amount > 0)`. Only `status` and `updated_at` ever change.
- **`webhook_events`**: `event_id` primary key, `order_id` → `orders(id)`, plus the mapped `status` and the `outcome` (`applied` or `ignored`).

## Status changes

Status currently only moves up: `pending → processing → failed → succeeded`. `failed` can still become `succeeded` (the provider decides whether money moved); `succeeded` is terminal. Anything else is recorded as `ignored` and answered `200`. The table is in [src/domain/status.ts](src/domain/status.ts) and would change, possibly gaining cycles, with refunds or partial payments.

## Duplicates, ordering and conflicts

- **Duplicate checkout:** `INSERT … ON CONFLICT DO NOTHING`, then compare amount and currency: `200` if equal, `409` if not. Concurrent identical requests create one order.
- **Duplicate webhook:** `event_id` primary key; a resend is `200` and never applied twice.
- **Ordering:** no timestamps; the final status is the highest-ranked one received, in any order.
- **Same `event_id`, different payload:** `200`, never applied, logged.

## Transactions and failures

- **Checkout:** no transaction; one atomic insert, then a read of fields that never change.
- **Webhook:** one transaction: `SELECT … FOR NO KEY UPDATE` on the order → decide → insert the event → update the order if applied → commit → respond. The lock serialises concurrent webhooks for an order; the response is sent only after commit.
- A failure before commit rolls back everything and returns `500`, so the provider's retry is processed like a first delivery. A retry after a lost response is a duplicate (`200`).
- **Tests can fail:** removing the lock makes the race test fail (3/3); a read-then-insert checkout makes the concurrent checkout test fail (5/5).

## Trade-offs and limitations

- **Row lock** over a conditional `UPDATE`: clearer steps, at the cost of webhooks for one order waiting in line.
- **Synchronous webhooks** over a queue: `200` means applied, but a slow database slows the provider.
- **Integer amounts:** exact, but capped at `Number.MAX_SAFE_INTEGER`.
- **Transitions in TypeScript:** easy to extend, but the database doesn't enforce them.
- **Migrations on startup:** one-command setup; unsafe with several instances.
- **Not covered:** authentication, webhook signatures, amount checks on webhooks, multiple providers, alerting, stuck-order detection. Webhook `400`/`404` and `GET /orders/:id` are tested by hand only.

**Before production:** auth and signed webhooks, a `payments` table (captures, refunds), migrations as a deploy step, metrics and alerts, reconciliation. 

## Time spent

- Roughly 5h30, excluding breaks and readme.

## AI tools

I used Claude Code.

- I gave Claude the assignment and used it as a partner. For each decision it laid out the options and their potential tradeoffs. I made every decision myself and had to justify it. After creating the design docs and skills I had it implement against those incrementally.


- Every step was reviewed and approved by me before the next one, and committed separately.
- Each step was checked with the typecheck, the test suite in Docker and manual calls.
- The concurrency tests were break-it checked: with the protection removed they must fail.
