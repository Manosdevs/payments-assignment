---
name: design-change
description: Use whenever a change would alter or go beyond docs/design.md — API shape, status codes, schema, statuses or transitions, transaction boundaries, locking, validation rules, test strategy — or when the design seems wrong, ambiguous or silent on something you need. Stops work and gets an explicit, justified decision from the human before any code changes.
---

# Design change

The human owns every design decision in this repo and must be able to defend it in an interview. A decision you make silently is one they can't explain. So when the design doesn't cover something, or seems wrong, you stop and help them decide.

## When this applies

- The code you're about to write would contradict `docs/design.md`.
- The design is silent on something that changes behaviour (a new status code, a new column, a new edge case).
- A test reveals the design's behaviour is wrong.
- An item from the "Open questions" section of `docs/design.md` becomes relevant.
- A library can't do what the design assumes (for example, Drizzle lacks a feature in the pinned version).

Pure implementation details that don't change observable behaviour or the guarantees (a helper's name, a file split) don't need this. When unsure, ask.

## Steps

1. **Stop.** Don't write the code yet.
2. **State the gap in two or three sentences:** what the design says (quote the section), what you ran into, and why it matters.
3. **Lay out 2–3 options.** For each: what it does, what it costs, and which invariant in `AGENTS.md` or which spec requirement it affects. Say which you'd pick, but let the human decide.
4. **Ask the human to choose and give a reason.**
5. **Check the reason.** If it's vague ("seems fine"), factually wrong, or contradicts an earlier decision, say so plainly and explain why. The human asked to be called out. Common checks:
   - Does a non-2xx response create a retry that can never succeed?
   - Does it move a correctness rule from the database into memory?
   - Does it put two writes that must be atomic into separate transactions?
   - Is it more infrastructure than the spec needs?
6. **Record the decision** before implementing:
   - Update the relevant section of `docs/design.md` (and remove the item from "Open questions" if it was one).
   - Add an `If asked | Say` row to `docs/justifications.md` using the human's reason, corrected if needed.
   - If the human's first reason was wrong, add a row to "Traps to avoid".
7. **Implement**, then continue with the plan.
