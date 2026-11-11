---
name: variant
description: User-only. Builds three throwaway designs of one piece of iCUE UI that differ on one axis, behind a picker on the real page with made-up data, so the user can choose one before its story is written. Run as /variant <piece of UI>.
disable-model-invocation: true
---

# Variant: three answers to one design question

Adapted from `variant` in [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT, © 2026 Jakub Krehel; ADR 0040).

For a UI choice a story hasn't settled yet. The variants are candidates: they're never ranked, never committed and never promoted. The one the user picks becomes the story's acceptance criteria, and `implement-story` builds it test-first. Only the user can start it, because a design exploration is never something to start on their behalf.

Arguments: one piece of UI, such as "how a removal is confirmed" or "the cast flow's legend". "The Production overview" is several pieces: list them and ask which.

## The floor every variant clears

These are the same in every variant. They're not an axis, and a direction that can only work by breaking one is dropped:

- CLAUDE.md's rules (one of each, a layout that explains itself, hidden rather than disabled controls, the item page frame), and `ux-reviewer`'s icon buttons first.
- Every control has an accessible name and a visible focus ring, and the keyboard reaches whatever a pointer does.
- Nothing scrolls sideways or clips at 320px.
- No meaning rides on colour alone, and motion respects `prefers-reduced-motion`.
- A destructive action confirms first.
- Truncated text has a way to the full value.

## Steps

1. **Scope it.** Say in one sentence what the piece is, where it renders and what it has to do.
2. **Learn the ground.** Read `apps/web/src/assets/styles.css`, the shared components it would use and its neighbours on the page. Variants use iCUE's tokens, classes and Nunito Sans, and look as if they could ship tomorrow.
3. **Name one axis and three positions before writing code.** The axis is one of structure, density, emphasis or interaction, and each variant is a different position on it, such as Quiet, Inline and Dialog, never Option A. Wording isn't an axis, because `code-reviewer` and the ACs own it. Make five only if the user asks.
4. **Build in a worktree** (`EnterWorktree`, then `pnpm install`), on the page that will hold the piece, with the demo show's data (`pnpm demo`). The hooks still apply there: the stop gate runs `pnpm check` in the dirty worktree, so keep the variants typed and formatted, and fix what it reports. A `?__variant=<name>` parameter picks the variant, and a grouped list beside the piece sets it, styled unlike iCUE. Only the hosting page imports the variants. If no page exists yet, build one self-contained HTML file in the scratchpad, with iCUE's tokens and the same picker, and give the user its full path.
5. **Look at each variant** at 320px, 360px and desktop width. Check that it renders, responds and keeps the floor. Then give the user a table and stop:

   | Variant | Position on the axis | Right when | Costs |
   |---|---|---|---|

   Mark no favourite. If asked, answer from how often volunteers meet the piece, mid-rehearsal and on a phone, not from which one was most fun to build.
6. **Hand the choice to a story.** Offer `write-story` (or `write-prd`, for a larger piece) with the chosen variant written as Given/When/Then. Then remove the worktree, and check that the user's branch has nothing of `__variant` in it. For another round, keep the worktree and go back to step 3, with new positions around the one they leaned towards.
