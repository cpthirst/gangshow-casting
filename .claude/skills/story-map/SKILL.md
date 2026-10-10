---
name: story-map
description: Break an approved PRD into epics and user stories (a story map). Use after write-prd, or when the user asks to break down, slice, plan or sequence a feature into epics, stories or tickets.
---

# Story map: epics → stories

Input: `docs/product/<feature>/prd.md` (must be `status: approved`).
Output: `docs/product/<feature>/story-map.md` from [templates/story-map.md](templates/story-map.md), then one story file per story via the `write-story` skill.

## Steps

1. **Read the PRD.** If it isn't approved, stop and offer to run `write-prd` first.
2. **Find the epics** (`E1`, `E2`, …). An epic is one coherent, user-visible capability that maps to one or more FRs. Usually 2–6 per feature.
3. **Slice each epic into stories** (`E1.S1`, `E1.S2`, …). Each story must be:
   - **A vertical slice**: delivers observable behaviour end-to-end (UI + API + infra as needed), not "build the database layer".
   - **Small**: about a day's work, one PR under ~400 changed lines. Split anything bigger.
   - **INVEST**: independent where possible, valuable, testable.
   - For a brand-new feature, make `E1.S1` a **walking skeleton**: the thinnest end-to-end path, deployed.
4. **Sequence.** Record dependencies (`Depends on`). Order stories so each one builds on finished work.
5. **Check coverage.** Every FR in the PRD maps to at least one story. Fill in the coverage table; any gap is a missing story or a requirement to drop (ask the user which).
6. **Checkpoint.** Show the map (epics, story titles, order, coverage) and wait for the user's approval or changes. Don't create story files before then.
7. **Create the stories.** For each row, use the `write-story` skill. Stories with no open questions start as `ready`; anything unclear starts as `draft`.
8. Run `pnpm lint:docs` and fix every error.

## Keep the map current

`implement-story` updates the Status column as work moves. If scope changes, update the map *and* the PRD. They must not drift apart.
