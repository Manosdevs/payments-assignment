# AGENTS.md

Instructions for any coding agent working in this repo.

## What this repo is

A take-home exercise: a small TypeScript/Node.js service that simulates the backend of an e-commerce checkout (checkout intents, provider webhooks, order status). It will be reviewed and then **defended in an interview by the human who owns it**. The goal is not just working code: the human must be able to explain and defend every line.

That changes how you work:

- **The design is already decided.** `docs/design.md` is the source of truth. Implement it; don't redesign it.
- **Never make a design decision silently.** If something isn't covered by the design, or the design seems wrong, stop and use the `design-change` skill.
- **Explain as you go.** After each step, tell the human what you changed and why in plain language, pointing to the design-doc section it implements.
- **Small and readable beats clever.** The spec rewards "a small solution you can explain and verify" over a larger one.

## Read before working

| File | What it is |
| --- | --- |
| `docs/spec.pdf` | The original assignment |
| `docs/design.md` | Every behaviour: API, schema, status model, transactions, tests, setup |
| `docs/justifications.md` | Why each decision was made, including mistaken ideas to avoid |
| `docs/implementation-plan.md` | Build order with checkboxes. Work through it in order. |
| `docs/ai-log.md` | Running log of AI help (create it on first use) |

## Invariants: never break these

Each one is tested or will be. If a change would weaken one, stop and ask.

1. **The database arbitrates every race.** No in-memory locks, caches or check-then-act logic for correctness.
2. **Checkout:** `INSERT … ON CONFLICT (merchant_id, order_reference) DO NOTHING RETURNING`, then `SELECT` and compare `amount` and `currency`. Never `SELECT`-then-`INSERT`. `201` new, `200` matching retry, `409` mismatch.
3. **Webhook transaction order:** lock the order with `SELECT … FOR NO KEY UPDATE` → decide the outcome with `allowedFrom` → insert the event with its final outcome, `ON CONFLICT (event_id) DO NOTHING` → `UPDATE` the order only if applied → commit.
4. **`FOR NO KEY UPDATE`, never `FOR UPDATE`**, and never a plain `SELECT` before a status change.
5. **The event insert and the order update are in the same transaction.** Never split them.
6. **Send the HTTP response only after the transaction has committed.** Return a result object from the transaction callback; respond after `await db.transaction(…)` resolves.
7. **Status only moves up**, enforced by the `allowedFrom` table in TypeScript, not by enum ordering in SQL.
8. **Stale or equal-rank events and same-ID-different-payload events get `200`.** Never a non-2xx for something a retry can't fix.
9. **Webhook codes:** malformed `400`, unknown order `404`, database failure `500`. Don't change these.
10. **Isolation level is READ COMMITTED** (the Postgres default). Don't raise it.
11. **Orders are immutable** except `status` and `updated_at`. No endpoint edits or deletes orders.
12. **`TEST_TX_DELAY_MS` is test-only.** The app must refuse to start if it is set and `NODE_ENV !== 'test'`.

## Stack and conventions

- Node.js (current LTS, pinned in the `Dockerfile` and `.nvmrc`), TypeScript in strict mode.
- Express, Zod for validation, pino for logs.
- PostgreSQL (pin a major version in `docker-compose.yml`), Drizzle ORM with `drizzle-kit`, the `pg` driver.
- Jest with `ts-jest`, `supertest`.
- **Pin the Drizzle version** and read the docs for that version: Drizzle is pre-1.0 and the docs site may describe a newer API. Before relying on `.for('no key update')`, confirm it exists in the installed version; if not, use a `sql` fragment and leave a comment.
- JSON fields are snake_case at the API boundary. Map to and from camelCase in one place.
- Amounts: `bigint({ mode: 'number' })`, validated as positive integers up to `Number.MAX_SAFE_INTEGER`.
- Comments explain **why**, especially at lock and transaction sites. Reference the design-doc section, e.g. `// See design.md › Concurrency control`.

### Suggested layout

```
src/
  app.ts              Express app factory (no listen), used by tests and server
  server.ts           config check → migrate() → listen
  config.ts           env parsing with Zod; TEST_TX_DELAY_MS guard
  db/schema.ts        enums, tables, constraints
  db/client.ts        pg Pool (max = DB_POOL_SIZE) + drizzle instance
  domain/status.ts    allowedFrom table and helpers
  domain/provider.ts  provider status → our status map
  http/schemas.ts     Zod request schemas
  http/orders.ts      POST /orders, GET /orders/:id
  http/webhooks.ts    POST /webhooks/payments
  services/checkout.ts
  services/webhook.ts
drizzle/              generated SQL migrations (committed)
tests/                globalSetup, helpers, *.test.ts
docker/initdb/        creates payments_test on first start
scripts/send-webhook.sh
request.http
```

Adjust the layout if there's a good reason, but keep it this small.

## Commands

```bash
cp .env.example .env
docker compose up --build                            # start Postgres, migrate, serve
docker compose run --rm app npm test                 # tests in a container
docker compose down -v && docker compose up --build  # full reset
npx drizzle-kit generate                             # new migration from schema.ts
npm run typecheck                                    # tsc --noEmit
```

## How to work

1. Pick the next unchecked step in `docs/implementation-plan.md`.
2. Implement only that step. Use the matching skill:
   - `db-code` for any query, transaction or migration
   - `concurrency-tests` for any test that sends overlapping requests
   - `design-change` the moment anything conflicts with or isn't covered by the design
3. Finish with the `verify-step` skill: typecheck, tests, invariant check, plan checkbox, summary for the human, AI log entry.

**Commits:** don't commit unless the human asks. The spec asks for a real development history, so after each step propose a short commit message describing that step.

**Don't:** add infrastructure the design doesn't call for (queues, workers, outbox, caching, auth), add dependencies without saying why, edit a migration that has already been applied (generate a new one), or touch `docs/design.md` except through the `design-change` skill.

## Open questions

See the "Open questions" section at the end of `docs/design.md`. Don't resolve them yourself; ask the human when you reach the step they affect.
