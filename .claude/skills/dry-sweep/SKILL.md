---
name: dry-sweep
description: User-only audit of duplication and bloat across the repo, in code and tests. Reports ranked findings for the user to pick from, and changes nothing. Run as /dry-sweep every few features.
disable-model-invocation: true
---

# DRY sweep: find it, rank it, let the user pick

Read-only: change nothing until the user has picked. The gate catches literal copies and dead exports. This looks for what it can't see.

## Steps

1. **Measure.** Lines of code against lines of tests, by area, and the longest files of each.
2. **Run the detectors.** `pnpm lint:dead`, and `jscpd` on the test files too. A low percentage proves little: near-copies don't show up.
3. **Compare siblings side by side.** For each family in CLAUDE.md's "Simplicity" rules, read the members together and note what differs. Count repeated guards, wrappers and helpers with Grep.
4. **Audit the tests.** Tests whose titles repeat across files, tests of a shared piece left on its pages, helpers copied three times or more, and checks of exact wording where the wording isn't the requirement. Read a sample before trusting a count.
5. **Look for unfinished moves.** Shared pieces some siblings skipped, names borrowed from one department, wrappers with no production caller.
6. **Report.** Rank by what a future reader saves, with estimated lines and evidence. Say what you'd leave alone and why, as a literal, searchable list can beat a generated one.
7. **Ask** which to do, on a new branch, one commit per item. Each commit passes `pnpm check`.
