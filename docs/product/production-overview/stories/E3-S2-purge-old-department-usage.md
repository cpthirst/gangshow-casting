---
id: production-overview.E3.S2
title: Purge the old department pages' usage
epic: E3
status: draft
---

## Story

As the maintainer, I want the visits recorded for the retired Stage, Tech and Costume pages and their views deleted, so that the usage records hold only pages that exist, and no stale data is kept for longer than it's useful.

## Acceptance criteria

### AC1: The old pages' visits are deleted
Given usage records for visits to the Stage, Tech and Costume (or Wardrobe) pages, and switches to their Scenery, Props, Mic plot and SFX views
When the maintainer runs the purge after the deploy
Then those records are deleted from the stored usage records
And it reports how many it deleted

### AC2: Nothing else is touched
Given usage records for the Overview, the casting pages, exports, item pages and sessions
When the purge runs
Then every one of them is unchanged

### AC3: Safe to repeat
Given the purge has already run
When the maintainer runs it again
Then it deletes nothing and reports 0

## Notes

- FRs: FR13
- Depends on: production-overview.E2.S1
- **Open question (PRD), blocks `ready`**: purge these visits, or keep them as history? E2.S1 already hides them from the Usage page, so keeping them costs nothing visible. Owner: maintainer.
- Extends the existing `pnpm usage purge` command (stage-props AC11), which today deletes only the four old Production pages' visits. Ask before running it against the real table (CLAUDE.md).
- Once it has run against the real table, the purge's bridging code is removable, like release 1.16's.
- Out of scope: any other usage change.
