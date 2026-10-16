# 0012. An advisory UI and UX consistency reviewer

- **Status**: Accepted
- **Date**: 2026-10-16
- **Deciders**: Nick Hirst

## Context

The web app has grown page by page: the Running order, Cast, the Items list, each item's casting page and the Overview. Consistency between them (icon buttons first on the left, on their own line on phones; shared card, pill and heading styles; the same wording for the same actions) has mostly been enforced by the user spotting differences after the fact. The existing reviewers (ADR 0003) each judge one change for correctness, tests, security or infra. None of them compares a change with the rest of the app's UI. Consistency is often a matter of taste and product judgement, which the user wants to keep.

## Options considered

1. **Do nothing**: no extra review cost / inconsistencies keep reaching the user to find.
2. **Fold it into `code-reviewer`**: no new agent / dilutes a reviewer focused on code, and its blockers would force UI decisions the user wants to make.
3. **A separate `ux-reviewer` that can block**: consistent with the other reviewers / UI taste calls would be fixed silently, or loop until the round limit.
4. **A separate, advisory `ux-reviewer`**: a fresh look at the whole app's UI for every web change, with the user deciding what to act on / one more agent per review and one more question for the user.

## Decision

We will add **`ux-reviewer`**, a read-only subagent that runs in the review loop alongside the others, whenever a diff touches `apps/web`. It compares the change with the rest of the web app for consistent layout, components, wording, interaction and accessibility. Its findings are **advisory and never block**. After the review loop, the main agent lists them and asks the user which to fix now, which to note in the PR, and which to leave. In batch mode it asks too, rather than deciding itself.

## Consequences

- **Easier**: inconsistencies are spotted before the user has to find them, and the user keeps the final say on UI.
- **Harder**: another reviewer's tokens and time on every web change, and a question for the user at the end of each one.
- **Revisit if**: its findings are mostly ignored (too noisy), or the user keeps accepting them all (they could become rules, or move into `code-reviewer`).
