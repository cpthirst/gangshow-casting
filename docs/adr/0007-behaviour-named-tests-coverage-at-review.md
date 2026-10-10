# 0007. Behaviour-named tests; AC coverage checked at review

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

Tests had to be named after stories (`describe("<story id>: …")`, `it("AC1: …")`), `pnpm lint:docs` failed `done` stories without matching names, and the guard hook asked for approval whenever a test lost assertions. In practice:

- story IDs in test names tie code to planning documents; they go stale and add noise to every test file;
- a name proves nothing about what a test checks: `test-auditor` was already the real coverage check;
- tests legitimately change during refactors and behaviour changes, so treating every removed assertion as suspicious was friction.

## Options considered

1. **Keep name-based traceability**: deterministic and free / bloat, staleness, and a false sense of coverage.
2. **Behaviour-named tests, coverage judged at review**: idiomatic tests, with `test-auditor` mapping ACs to tests by reading them and the PR listing the mapping / relies on reviewers, not a deterministic gate.

## Decision

Tests are named after the behaviour they check. `pnpm lint:docs` validates story structure only. `test-auditor` maps each AC to its covering test(s) by behaviour, and an AC with no covering test is a blocker; the PR template records the mapping. Editing or deleting tests is allowed when the reason is stated; `code-reviewer` checks changed tests for unexplained weakening. The guard still blocks committed `.skip` / `.only`.

This replaces the "test named for each AC" gate described in ADR 0003's context; ADR 0003's review decision is unchanged.

## Consequences

- **Easier**: readable, conventional tests; refactoring tests without fighting the harness.
- **Harder**: AC coverage is a review judgement, so it depends on the review loop running before every PR (it does, by standing rule).
- **Revisit if**: reviewers miss uncovered ACs; then consider a coverage threshold in the gate rather than naming rules.
