# 0034. Simplicity rules for authors and reviewers

- **Status**: Proposed
- **Date**: 2026-11-07
- **Deciders**: Nick Hirst

## Context

The `consult` skill brought in a one-off consultant, and its findings became the `simplify` PRD (`docs/product/simplify/prd.md`). Every finding had passed review:
- each department is described by hand in about ten places;
- four item pages each build the same frame, and the copies have drifted;
- scenery notes outlive a cut item;
- a refusal rule (ADR 0029) has needed two patches for single routes;
- pages carry taglines, hint lines and explanations of disabled controls;
- shared styles are named after the page that first used them (`ux-reviewer`'s brief even told agents to reuse them by those names);
- the production id is hard-coded in 7 places.

The reviewers judge one diff at a time. A diff shows one copy, so "abstract on the third copy" never fired. Nothing in the author's rules or the reviewers' briefs asked whether a sentence on a page should exist at all, only how it was worded. Without a change, every new department or item page will repeat the pattern, and paying it down will keep needing another consultant.

## Options considered

1. **Do nothing; run `consult` again from time to time**: no new rules to keep. But the debt builds up between visits, and each pay-down is a feature of its own, like `simplify`'s 22 stories.
2. **Deterministic checks only** (tests that fail on a hard-coded production id, or on per-item data a cut leaves behind): reliable where a rule can be stated as code. `simplify` E1.S5 and E4.S4 add some. But copied siblings and text doing the layout's job are judgements, not patterns a test can match.
3. **Put the bar in the author's rules and in the reviewers' checks, as the clean-code standard was (ADR 0003), and keep the tests in option 2 where they apply.** An agent meets the rule before writing, and a reviewer checks it after.

## Decision

We will take option 3:
- **CLAUDE.md** gains a "Simplicity" section: extend the shared piece and never copy a sibling; say a thing once; fix the rule, not the case; let the layout explain itself; name shared things for their purpose. Its domain rules add the item page frame, deleting all of an item's data when it's cut, and taking the production from one place.
- **`code-reviewer`** searches beyond the diff for each new piece's siblings and counts them. A copy that bypasses an existing shared piece, a value said twice, per-item data a cut leaves behind, or an item page missing the frame is a `blocker`. A third copy with no shared piece, a special-case patch, a borrowed name, or text doing the layout's job is a `should-fix`.
- **`ux-reviewer`** flags text doing the layout's job and checks the item page frame. It stays advisory (ADR 0012).
- **The planning skills** carry the bar forward. `write-prd` makes a new sibling join its family. `story-map` puts the extraction of a shared piece first. `write-story` writes no AC that asks for explanatory text. `implement-story` finds the siblings before planning tests.
- **`consult`** stays, now as an audit of the rules. Its report adds "Missed at review", and its last step proposes the brief lines that would have caught each finding.

## Consequences

- **Easier**: a new department or item page joins its family on the first attempt. Each future `consult` makes the briefs tighter, not just the code.
- **Harder**: `code-reviewer` does more work per review, searching the repo as well as the diff. Until `simplify` builds the shared department list and item frame, "a shared piece exists" is often false, so new siblings get a `should-fix` instead of a `blocker`.
- **Revisit if**: a later `consult` finds copies or explanatory text that reached `main` after this ADR. Then turn the rule into a test where it can be stated as code, or make the `should-fix` a `blocker`.
