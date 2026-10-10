# 0001. Record architecture decisions

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

Agents and humans both change this codebase. Without a written record of why things are the way they are, agents "fix" deliberate choices (e.g. unifying TypeScript versions) and people repeat old debates.

## Options considered

1. **Comments and commit messages only**: zero overhead / reasons scattered and hard to find.
2. **ADRs in `docs/adr`** (Nygard format): one short file per decision, reviewed in PRs / small overhead per decision.

## Decision

We will record significant technical decisions as ADRs in `docs/adr`, using the `adr` skill.

## Consequences

- **Easier**: onboarding people and agents; revisiting decisions with their original context.
- **Harder**: requires discipline to write one when a decision is made.
- **Revisit if**: ADRs stop being written or read.
