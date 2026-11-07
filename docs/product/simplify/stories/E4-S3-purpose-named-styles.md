---
id: simplify.E4.S3
title: Give the shared styles names that say what they are
epic: E4
status: draft
---

## Story

As the maintainer, or an agent working for them, I want the shared look for cards, button rows, forms, tables and the Open column to have plain names, so that a new page reuses them without first learning which page they were borrowed from.

## Acceptance criteria

### AC1: Pages look the same as today
Given every page in the app
When someone opens it at 320px, 360px and desktop width
Then it looks as it did before the rename, and nothing scrolls sideways

### AC2: Each shared style is named for what it is
Given the styles for cards, button rows, forms, tables and the Open column
When the maintainer reads them
Then each is named for what it is (e.g. a card, not a "role card"), and no page uses another page's name for it

### AC3: The UX reviewer uses the new names
Given the UX reviewer's brief tells agents which shared styles to reuse
When it names them
Then it uses the new names

## Notes

- FRs: FR16
- Depends on: simplify.E2.S4 (Epic 2 merges most of the pages that borrow the old names)
- AC1 rests on the browser layout walks plus a look at each page with `pnpm demo`. Use `screenshot-checker` for any screenshots.
- AC2 and AC3 are checked at review.
- AC3 changes `.claude/agents/ux-reviewer.md`, a harness change: ask the maintainer first (CLAUDE.md).
