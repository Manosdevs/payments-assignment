# AI log

## 2026-10-06 — Step 1: Project skeleton
- What the agent did: compared the existing skeleton with design.md; pinned every dependency to an exact version; added pino, jest, ts-jest, supertest and their types; added the `test` script (`jest --runInBand`), `.nvmrc` and a minimal `jest.config.js`.
- What the human decided or changed: downgrade TypeScript 7.0.2 → 5.9.3 because TS 7 (native Go port) has no JS compiler API and ts-jest requires `typescript <7`. Keep the skeleton's file names, `/health`, dotenv and tsx. Follow design.md for Docker (next step).
- How it was checked: `npm run typecheck`, `npm run build`, `npx jest --listTests` all succeed; confirmed Drizzle 0.45.3 exposes `.for('no key update')` in its type definitions.

## 2026-10-06 — Step 2: Docker and configuration
- What the agent did: replaced the multi-stage prod image and separate `migrate`/`api` services with a single-stage Dockerfile (all deps, Jest included) and one `app` service, per design.md › Local setup; added `docker/initdb/01-create-test-db.sql`; trimmed `.env.example` to the four documented keys.
- What the human decided or changed: follow the design rather than keep the skeleton's Docker setup.
- How it was checked: `docker compose down -v && docker compose up db` → `psql -l` lists `payments` and `payments_test`; `docker compose build app` succeeds; app container healthy, `GET /health` → 200, unknown route → 404; `npx jest --listTests` runs in the container.
- Issue found: `npm ci` in the image (npm 11.19) rejected the lockfile written by host npm 11.6.2 — missing `@emnapi/core` and `@emnapi/runtime` (optional peers of Jest's resolver). Fixed by `npm install --package-lock-only` in `node:24-alpine`; diff adds only those two entries.
