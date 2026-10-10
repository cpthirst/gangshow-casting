---
name: implement-story
description: Implement a ready user story test-first, turning each acceptance criterion into a failing test and then code. Use when the user asks to build, implement or pick up a story (e.g. "implement story-capture.E1.S2", "do the next story").
---

# Implement a story (AC-driven TDD)

Input: a story file in `docs/product/<feature>/stories/`. Done means: every AC has a passing test, `pnpm check` is green, and the story is marked `done`.

## Steps

1. **Pick the story.** If asked for "the next one", take the first `ready` story in `story-map.md` order whose dependencies are `done`. If the story is `draft`, refine it with the `write-story` skill first, and get the user's agreement.
2. **Branch** off an up-to-date `main`: `feat/<feature>-e<n>-s<n>-<slug>`.
3. **Mark it `in-progress`** in the story frontmatter and the story map.
4. **Plan the tests.** For each AC, decide where its test lives: `packages/shared` for contracts, `apps/api` by calling its handlers directly, `apps/web` with `mount()`, or `infra` with `Template` assertions. If the API shape changes, the zod schema in `packages/shared` changes first.
5. **For each AC, in order:**
   1. **Red**: write a test for the AC, named after the behaviour (e.g. `it("shows unavailable when the API is unreachable")`), structured Given / When / Then. Run it and confirm it fails *for the expected reason* (missing behaviour, not a typo).
   2. **Green**: write the minimum code to pass it.
   3. **Refactor** with all tests green.
6. **Gate.** Run `pnpm check` and get it green.
7. **Review.** Run the review loop in CLAUDE.md. `test-auditor` always runs for a story; give it the story path. Keep the non-blocking findings for the PR.
8. **Close out.** Set `status: done` in the story and the story map, then run `pnpm lint:docs` (it checks the story's structure).
9. **Commit**: `feat(<package>): <story title> (<story id>)`. Offer the `open-pr` skill, passing along the review notes.

## When reality disagrees with the story

- **AC is ambiguous or untestable**: stop and ask. Don't pick an interpretation silently.
- **You find extra work**: if it's outside the ACs, note it under *Notes* in the story as a follow-up and suggest a new story. Don't widen scope.
- **A significant design choice comes up** (new dependency, data model, infra shape): record it with the `adr` skill.
