# 0040. Interface review ideas from the interfaces skills

- **Status**: Accepted
- **Date**: 2026-11-11
- **Deciders**: Nick Hirst

## Context

[jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT, © 2026 Jakub Krehel) is a pack of agent skills for building interfaces. It has knowledge skills (accessibility, layout, writing, typography, colour, polish), a screen review and a change review, and procedures that build throwaway pages: `variant` (three designs behind a picker), `state-machine` (every state of one component behind a switcher) and `break` (one component under worst-case content).

Checked against iCUE, most of its rules already hold: measured contrast, focus rings, a skip link, a reduced-motion guard, one pattern for announcements, the native `<dialog>`, button alternatives to dragging, and `en-GB` formatting. What it would add is a sharper `ux-reviewer` and two ways of looking at UI before it is built. A throwaway mock-up made with the three procedures found two things no reviewer had raised: nine removals that ask through the browser's own OK/Cancel box, and item pages that are blank while they load.

## Options considered

1. **Do nothing**: no cost / `ux-reviewer` keeps judging only the post-change state, and blank loading states and lost accessibility attributes go unseen.
2. **Install the plugin**: every rule at once, kept up to date by its author / ten skills that start themselves load their descriptions on every turn, its examples are React and Tailwind, and `better-writing` raises wording the user has asked `ux-reviewer` to leave alone (ADR 0012).
3. **Adapt the parts that fit**: three checks into `ux-reviewer`, and `state-machine` and `variant` as iCUE skills that use the demo show, worktrees and the story chain / we keep the adapted text ourselves.

## Decision

We will adapt the parts that fit, crediting the source in each file:

- **`ux-reviewer`** gains an evidence-not-taste bar, a short list of problems it always reports (still advisory, ADR 0012), a check of the *removed* side of the diff for lost accessibility signals, and a check that a change reaches every sibling page and every state.
- **`states`** (`state-machine`, renamed) and **`variant`** are new user-only skills. Each builds its throwaway page in a separate worktree, with made-up data from the demo show, and never commits it. A `variant` choice becomes a story's acceptance criteria, and `implement-story` builds it test-first; nothing from the harness is promoted.
- `break`'s worst-case content will go into the browser layout tests' made-up data (ADR 0011), in its own change, rather than becoming a skill.

The other skills are left out: `afk` overlaps `consult` and `dry-sweep`, and the colour, typography and polish rules are already met or don't apply.

## Consequences

- **Easier**: `ux-reviewer` catches regressions and half-finished moves, and a design choice can be seen on the real page, with every state and permission, before a story fixes it.
- **Harder**: the adapted text is ours to maintain, and won't follow the source's updates.
- **Revisit if**: `states` and `variant` go unused for a few features (delete them), or the source gains a check that `ux-reviewer` keeps missing.
