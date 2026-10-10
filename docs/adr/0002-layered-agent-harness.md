# 0002. Layered agent harness

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

Coding agents work autonomously in this repo (see CLAUDE.md → Autonomy). Instructions alone (CLAUDE.md, skills) are advisory, so agents can and do ignore them. We need quality to hold up without a human watching every step.

## Options considered

1. **Instructions only** (CLAUDE.md + skills): cheapest / nothing is enforced.
2. **CI only**: authoritative / feedback arrives late, after a whole task has drifted.
3. **Layered**: instructions → Claude Code hooks (in the loop) → git hooks (Lefthook) → CI / more moving parts to maintain.

## Decision

We will layer enforcement. Each layer is fast where it runs and backs up the one before it:

| Layer | Runs | Checks |
|---|---|---|
| CLAUDE.md + skills | always / on demand | conventions and procedures (advisory) |
| PreToolUse guard | before each action | protected files, test weakening, git bypass |
| PostToolUse | after each edit | format + package typecheck |
| Stop gate | when the agent finishes | `pnpm check` |
| Lefthook pre-commit | each commit | Biome on staged files |
| CI | each push / PR | full gate, the final authority |

Hook logic is TypeScript with unit tests, and it's part of the gate.

## Consequences

- **Easier**: agents correct themselves mid-task; "done" means the gate actually passed.
- **Harder**: ~5s added when an agent finishes; the harness is code that needs maintaining.
- **Revisit if**: the hooks slow work noticeably, or agents routinely work around them.
