# 0031. One yes opens a pull request

- **Status**: Accepted
- **Date**: 2026-10-29
- **Deciders**: Nick Hirst

## Context

The harness (ADR 0002) put `git push` and every `gh pr` command on the **ask** list in `.claude/settings.json`. So once the maintainer said yes to opening a PR, Claude Code asked again for the push, and again for `gh pr create`. That's three approvals for one decision. The `batch-stories` skill existed partly to lift those two prompts, by editing the settings for one feature and restoring them afterwards. That needed a memory note so a lost session would know to restore them, and a test that the override was never committed.

The maintainer asked for one yes to be enough.

## Options considered

1. **Do nothing**: every push stays a separate human check. But the prompts repeat a decision already made, and `batch-stories` keeps its edit-and-restore machinery.
2. **Allow rules in each person's `settings.local.json`**: committed config stays untouched. But an **ask** rule outranks an allow, so the prompts would stay.
3. **Allow `git push` and `gh pr create` in the committed settings, and keep asking for the rest**: the one yes in the conversation is the check. Merging, closing, reopening, editing and reviewing PRs still ask. The destructive push forms join the deny list.

## Decision

We will take option 3. In `.claude/settings.json`:
- `git push` and `gh pr create` are **allowed**;
- `gh pr merge`, `close`, `reopen`, `edit` and `review` are **asked**;
- `git push --force-with-lease`, `--delete`, `-d` and `origin +…` join the **denied** force-pushes and pushes to `main`.

CLAUDE.md still says to ask first before pushing or opening a PR. That question is now asked once, in the conversation, and its yes covers the branch's push and its PR.

`batch-stories` no longer edits the settings. It's now only the user's go-ahead to build one feature's stories on one branch, pushing as it goes, with one PR at the end.

## Consequences

- **Easier**: one yes opens a PR. Batch mode needs no settings override, no restore, and no "MUST RESTORE" memory note.
- **Harder**: nothing in the tool layer stops a push the user didn't agree to. Asking first is now instruction, not enforcement. Deny rules match only the start of a command, so a force-push written another way (`git push origin HEAD --force`) isn't denied. The pre-push hook still blocks any push to `main`, the GitHub ruleset protects `main`, and every push re-runs the gate.
- **Revisit if**: an agent pushes or opens a PR unasked, or force-pushes a branch. Then move the push back to **ask**, or have `guard.ts` refuse destructive push flags wherever they appear.
