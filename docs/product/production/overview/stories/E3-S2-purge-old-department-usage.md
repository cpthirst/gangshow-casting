---
id: production-overview.E3.S2
title: Remove the usage purge command
epic: E3
status: ready
---

## Story

As the maintainer, I want the repo's usage purge command and its code removed, so that the codebase holds no one-off bridging tooling, now that the old pages' visits are purged once by hand instead.

## Acceptance criteria

### AC1: The purge command is gone
Given the repo's commands
When the maintainer looks for a way to purge usage
Then there is no `pnpm usage` command, and no code whose only job was to purge retired pages' usage
And the README, CLAUDE.md and the hosting guide no longer mention it

### AC2: The Usage page is unchanged
Given usage records for the Overview, the casting pages, exports, item pages and sessions, and for the retired pages and views
When someone opens the Usage page
Then it shows exactly what it showed before the removal

## Notes

- FRs: FR13
- Depends on: production-overview.E2.S1
- Decided 2026-10-27 (maintainer): purge the visits recorded for the Stage, Tech and Costume pages and their views, as a **one-off** after this release deploys, not a repeatable command. The agent runs that delete against the real table only when the maintainer asks; it is not part of this story's code.
- The existing `pnpm usage purge` (production-props AC11) has already run against the real table (release 1.16), so it goes too.
- Keep anything the Usage page still uses to hide retired pages; remove only what served the purge.
- Out of scope: the `account roles` bridging command, and any other usage change.
