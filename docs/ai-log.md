# AI log

## 2026-10-06 — Step 1: Project skeleton
- What the agent did: compared the existing skeleton with design.md; pinned every dependency to an exact version; added pino, jest, ts-jest, supertest and their types; added the `test` script (`jest --runInBand`), `.nvmrc` and a minimal `jest.config.js`.
- What the human decided or changed: downgrade TypeScript 7.0.2 → 5.9.3 because TS 7 (native Go port) has no JS compiler API and ts-jest requires `typescript <7`. Keep the skeleton's file names, `/health`, dotenv and tsx. Follow design.md for Docker (next step).
- How it was checked: `npm run typecheck`, `npm run build`, `npx jest --listTests` all succeed; confirmed Drizzle 0.45.3 exposes `.for('no key update')` in its type definitions.
