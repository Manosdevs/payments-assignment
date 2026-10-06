# Implementation Plan

Work through the steps in order. Each step ends with the `verify-step` skill and a proposed commit message. Tick the box only when every "Done when" item holds.

Correctness comes first: the spec says to focus on correct behaviour, then explain what's unfinished. If time runs short, steps 1–9 are the core; 10 and 11 are presentation.

## 1. Project skeleton

- [x] `package.json` with scripts `build`, `start`, `dev`, `typecheck`, `test` (`jest --runInBand`)
- [x] `tsconfig.json` (strict), `.nvmrc`, `.gitignore`
- [x] Pinned dependencies: express, zod, pino, pg, drizzle-orm, drizzle-kit, jest, ts-jest, supertest, typescript and their types

**Done when:** `npm run typecheck` passes on an empty `src/`.

## 2. Docker and configuration

- [x] `docker-compose.yml`: `db` (pinned Postgres major, port 5432, `pg_isready` healthcheck, volume) and `app` (`depends_on: condition: service_healthy`)
- [x] `docker/initdb/01-create-test-db.sql` creates `payments_test`
- [x] `Dockerfile` installing all dependencies, Jest included
- [x] `.env.example` with `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `DB_POOL_SIZE` and nothing else

**Done when:** after `docker compose down -v && docker compose up db`, both databases exist.

## 3. Schema and migration

- [x] `src/db/schema.ts`: enums `payment_status` and `event_outcome`; tables `orders` and `webhook_events` exactly as in design.md › Data model
- [x] `UNIQUE (merchant_id, order_reference)`; `webhook_events.event_id` primary key; foreign key to `orders(id)`
- [x] `npx drizzle-kit generate`, then **read the generated SQL** and confirm every constraint is there
- [x] Ask the human about the open question on CHECK constraints before finalising

**Done when:** the migration applies cleanly to an empty database and `\d orders` / `\d webhook_events` match the design.

## 4. App skeleton

- [x] `src/config.ts`: parse env with Zod; refuse to start if `TEST_TX_DELAY_MS` is set and `NODE_ENV !== 'test'`
- [x] `src/db/client.ts`: `pg` Pool with `max = DB_POOL_SIZE`, drizzle instance
- [x] `src/app.ts`: app factory, JSON body parser, error handler returning `500` JSON and logging the error
- [x] `src/server.ts`: `migrate()` then `listen`

**Done when:** `docker compose up --build` migrates and serves; an unknown route returns `404`.

## 5. Status domain

- [x] `src/domain/status.ts`: `allowedTo` table and a `canTransition(from, to)` helper
- [x] `src/domain/provider.ts`: provider status → our status map
- [x] Small unit test covering every cell of the transition table

**Done when:** the unit test passes and matches design.md › Payment status model.

## 6. Orders endpoints

- [ ] Zod schema for checkout (rules in design.md › API)
- [ ] `POST /orders`: insert-on-conflict, then select and compare (use `db-code` skill)
- [ ] `GET /orders/:id`: UUID check first; malformed or unknown → `404`
- [ ] snake_case response mapping in one place

**Done when:** manual curl gives `201`, then `200` on retry, then `409` with a different amount.

## 7. Test harness and checkout tests

- [ ] Jest `globalSetup` runs `migrate()` against `TEST_DATABASE_URL`
- [ ] `beforeEach` truncates `webhook_events, orders CASCADE`
- [ ] Test pool size 20
- [ ] Test 1: 10 concurrent identical checkouts (use `concurrency-tests` skill)
- [ ] Test 3: reused reference with a different amount
- [ ] Test 5: same reference, different merchant

**Done when:** `docker compose run --rm app npm test` is green.

## 8. Webhook endpoint

- [ ] Zod schema for the webhook payload, including UUID `order_id` and the provider status vocabulary
- [ ] `services/webhook.ts`: the exact transaction from design.md › Webhook processing (use `db-code` skill)
- [ ] `TEST_TX_DELAY_MS` sleep after taking the lock, before the event insert
- [ ] Logs for unknown order and conflicting payload
- [ ] The response is sent only after the transaction promise resolves

**Done when:** manual calls cover applied, ignored, duplicate, conflicting duplicate, `400` and `404`.

## 9. Webhook tests

- [ ] Test 2: same event delivered 10 times concurrently
- [ ] Tests 4a, 4b, 4c: stale and conflicting events after success
- [ ] Test 6: `failed` then `succeeded`
- [ ] Test 7: race B, `processing` and `succeeded` concurrently with the delay
- [ ] **Break-it check:** swap the lock for a plain `SELECT`, confirm test 7 fails, restore it, confirm it passes. Record the result for the README.

**Done when:** all tests are green and the break-it result is written down.

## 10. Provider simulation

- [ ] `scripts/send-webhook.sh <order_id> <status>` with a generated event ID
- [ ] `request.http` covering every endpoint, with one fixed `event_id` to demo duplicates

**Done when:** both work against `docker compose up`.

## 11. README

Keep it short. Required by the spec:

- [ ] Setup and test commands; configuration; migrations; calling the API; sending sample webhooks; resetting
- [ ] API formats, data model, allowed status changes
- [ ] Duplicate requests, event ordering, conflicting events
- [ ] Transaction boundaries and failure handling
- [ ] Trade-offs, limitations, unfinished work
- [ ] What to improve before production
- [ ] Time spent (the human fills this in)
- [ ] AI tools: which, for what, and how output was checked (draft from `docs/ai-log.md`; the human edits)

Point to `docs/design.md` for detail rather than duplicating it.

**Done when:** a reviewer could go from a clean checkout to green tests using only the README.
