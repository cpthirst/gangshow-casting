# 0038. Dead code, copies and test file size in the gate

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: Maintainer

## Context

ADR 0034's simplicity rules rely on authors and reviewers noticing duplication. A retro found they had worked for app code but not tests, which had grown to 1.7 lines for every line of code, with test files over 2,000 lines. Dead exports and unused wrappers only surfaced when the tools were run by hand. Nothing in `pnpm check` looked for any of this.

## Options considered

1. **Leave it to reviewers**: no new dependencies / reviewers see a diff, not the repo, and this is what slipped.
2. **Report only, in CI**: nothing blocks / a report nobody has to act on gets ignored.
3. **Fail the gate**: drift stops when it happens / two more dev dependencies, and false positives to configure away.

## Decision

We will run `knip` (dead files, exports and dependencies) and `jscpd` (under 1% copied, app code only) in `pnpm check`, and a harness test will hold test files to 800 lines. Older files over that sit on a list that can only shrink. Tests are left out of `jscpd`, where repeated setup is sometimes clearer; the `test-auditor` overlap step and `/dry-sweep` cover them.

## Consequences

- **Easier**: dead code and new copies fail straight away, and long test files stop growing.
- **Harder**: an export used only by a test, or a legitimate copy, needs a change or an entry in the config.
- **Revisit if**: false positives become routine, or the checks noticeably slow the gate.
