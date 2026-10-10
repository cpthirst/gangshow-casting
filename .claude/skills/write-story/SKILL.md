---
name: write-story
description: Write or refine a single user story with Gherkin (Given/When/Then) acceptance criteria in docs/product/<feature>/stories/. Use when creating stories from a story map, when the user asks for a story, ticket or acceptance criteria, or to move a draft story to ready.
---

# Write a story

Output: `docs/product/<feature>/stories/E<n>-S<n>-<slug>.md`, from [templates/story.md](templates/story.md).
`pnpm lint:docs` enforces this format, so a malformed story fails the gate.

## Format rules

- **ID**: `<feature>.E<n>.S<n>`, matching the story map. Never reuse or renumber IDs; mark dropped stories in the map instead.
- **Statement**: `As a <role>, I want <capability>, so that <benefit>.` The benefit is the user's, not the system's.
- **Status**: `draft` → `ready` → `in-progress` → `done`.

## Acceptance criteria

Each criterion is `### AC<n>: <name>` followed by `Given` / `When` / `Then` lines (use `And` for extra clauses).

Each AC must be covered by **at least one test** in `implement-story`, so write them to be testable:
- **One behaviour per AC.** If you need two `Then`s about unrelated things, split it into two ACs.
- **Observable outcomes only**: what a user or API client sees. No class, table or function names.
- **Cover the unhappy paths**: validation errors, empty states, unauthorised access, not found.
- **Concrete examples beat abstractions**: "Given a story titled 'Led migration'", not "Given some data".

## Definition of ready

A story moves to `ready` only when:
- every AC has Given/When/Then and no open questions;
- its dependencies are `done` or explicitly not blocking;
- it's small enough for one PR (under ~400 lines). If not, split it and update the story map.

Run `pnpm lint:docs` after writing.
