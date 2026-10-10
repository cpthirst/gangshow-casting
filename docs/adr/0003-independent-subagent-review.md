# 0003. Independent subagent review before done

- **Status**: Accepted (context partly superseded by 0007: tests are no longer named per AC)
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

The gate (ADR 0002) proves code compiles, passes its tests and has a test named for each AC. It can't tell whether those tests are meaningful, whether the code is readable, or whether a change is unsafe. The agent that wrote the code is a poor judge of it, because its context is full of its own reasoning.

## Options considered

1. **Human review only**: highest judgement / a bottleneck, and slow feedback for autonomous agents.
2. **Main agent self-reviews**: cheap / biased by its own context; tends to approve itself.
3. **Specialised read-only subagents**: fresh context, focused prompts, no write tools / extra tokens and time; Bash is a soft boundary.

## Decision

We will run specialised reviewer subagents (`code-reviewer`, `test-auditor`, `security-reviewer`, `infra-reviewer`) from the `implement-story` and `open-pr` skills, routed by the paths a diff touches. Blockers must be fixed, with at most 2 rounds before escalating to a human. Reviewers run on Sonnet to keep cost down, and they have no Edit or Write tools (a harness test enforces this). Humans still approve and merge PRs.

## Consequences

- **Easier**: catching weak tests, unreadable code, and security or infra risk before a human looks.
- **Harder**: a slower path to done; tokens spent on review; reviewers can be wrong, so disagreements go to the user.
- **Revisit if**: reviewers rarely find blockers (too costly for their value), or often find false ones (prompts need tuning).
