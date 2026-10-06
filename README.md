# payments-assignment

TypeScript · Express 5 · Zod · PostgreSQL · Drizzle · Docker

## Getting started

```bash
cp .env.example .env
docker compose up -d db     # Postgres on localhost:5432
npm install
npm run db:migrate
npm run dev                 # http://localhost:3000/health
```

Run everything (db + migrations + api) in Docker:

```bash
docker compose up --build
```

## Scripts

| Script                | Description                                   |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | Start in watch mode (tsx)                     |
| `npm run build`       | Compile to `dist/`                            |
| `npm start`           | Run compiled build                            |
| `npm run typecheck`   | Type-check without emitting                   |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts`  |
| `npm run db:migrate`  | Apply pending migrations                      |
| `npm run db:studio`   | Open Drizzle Studio                           |

## Structure

```
src/
  index.ts                  # server bootstrap + graceful shutdown
  app.ts                    # express app (routes, 404, error handler)
  config/env.ts             # zod-validated environment
  db/                       # drizzle client, schema, migrator
  errors/app-error.ts       # AppError + common HTTP errors
  middleware/
    error-handler.ts        # centralized error handler + 404
    validate.ts             # zod request validation
  routes/                   # routers
drizzle/                    # generated SQL migrations
```

## Errors

Throw (or reject with) an `AppError` subclass anywhere in a handler. Express 5
forwards async errors automatically, and the central handler responds with:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": "..." } }
```

`ZodError`s map to `400 VALIDATION_ERROR`, malformed JSON maps to `400 INVALID_BODY`,
and anything else maps to `500` (the message is hidden in production).
