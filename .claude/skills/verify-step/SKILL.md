---
name: verify-step
description: Use at the end of every step in docs/implementation-plan.md, or before saying any piece of work is done. Runs the checks, compares the change against the invariants, updates the plan and AI log, and gives the human a short explanation and a proposed commit message.
---

# Verify a step

The human has to defend this code. A step isn't done until it works, it respects the design, and the human knows what changed and why.

## 1. Run the checks

```bash
npm run typecheck
docker compose run --rm app npm test
```

If the step touched Docker or migrations, also run `docker compose down -v && docker compose up --build` and confirm the app starts.

Report failures honestly. Don't tick a box with failing checks, skipped tests or `.only` left in.

## 2. Check against the invariants

Re-read the "Invariants" list in `AGENTS.md`. For each one the step touched, confirm it still holds. Look in particular for:

- a plain `SELECT` before a status `UPDATE`
- `db` used instead of `tx` inside a transaction
- a response sent from inside a transaction callback
- a `try/catch` that swallows an error inside a transaction
- a non-2xx response for a stale or duplicate event
- a new dependency or piece of infrastructure the design didn't call for

Anything that conflicts with `docs/design.md` → stop and use the `design-change` skill.

## 3. Update the plan

Tick the completed items in `docs/implementation-plan.md`. Note anything left unfinished under the step, in one line.

## 4. Log AI help

Append to `docs/ai-log.md` (create it with a `# AI log` heading if missing):

```
## <date> — Step <n>: <title>
- What the agent did:
- What the human decided or changed:
- How it was checked: (tests, manual curl, reading generated SQL, break-it check)
```

This feeds the README's required AI-tools section.

## 5. Explain it to the human

In at most 10 lines:

- What changed, file by file, in plain language.
- Which section of `docs/design.md` it implements.
- **One or two things the human should be able to explain** about this step, phrased as interview questions (for example, "Why is the response sent after the transaction resolves?"). Point to the `docs/justifications.md` row if one exists.

## 6. Propose a commit

Suggest one commit message for the step, imperative mood, under 72 characters, for example `Add webhook transaction with order row lock`. Don't commit unless the human asks.
