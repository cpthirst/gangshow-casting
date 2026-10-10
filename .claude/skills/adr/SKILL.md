---
name: adr
description: Record an architecture decision record (ADR) in docs/adr. Use when a significant technical choice is made or reversed (a new framework or dependency, infrastructure or topology change, data model, cross-cutting pattern, or a change to the agent harness), or when the user asks to document a decision.
---

# Record an ADR

Output: `docs/adr/NNNN-<slug>.md` from [templates/adr.md](templates/adr.md).

## Steps

1. **Number it**: the next free four-digit number in `docs/adr/`.
2. **Write it** in under a page:
   - **Context**: the forces at play, the constraints, and why a decision is needed now.
   - **Options considered**: at least two, with honest pros and cons. "Do nothing" is often one of them.
   - **Decision**: what we chose, in active voice.
   - **Consequences**: what gets easier, what gets harder, and what we'd watch for to revisit it.
3. **Status** starts as `Proposed`. Change it to `Accepted` when the user agrees.
4. **Superseding**: never edit the substance of an accepted ADR. Write a new one, and set the old one's status to `Superseded by NNNN`.
5. **Link** the ADR from the PR and from any story it came out of.
