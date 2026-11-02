---
id: production-mics.E2.S2
title: Keep an allocation a reorder makes break the rule, clearable only
epic: E2
status: ready
---

## Story

As someone in the Tech team, I want an allocation that a running order change has made impossible to stay visible until I clear it, so that nothing I planned disappears without me seeing it.

## Acceptance criteria

### AC1: The allocation stays and can only be cleared
Given Mic 1 is Alex Morgan's in "Opening Number" and Sam Patel's in "Finale", which aren't next to each other
When the running order is changed and saved so "Finale" comes straight after "Opening Number" in the same half
Then Mic 1 in "Finale" still shows Sam Patel
And for someone with Tech its only action is to clear it

### AC2: Once cleared, it's greyed out like any blocked channel
Given that kept allocation of Mic 1 to Sam Patel in "Finale"
When someone with Tech clears it
Then Mic 1 in "Finale" reads "Used in previous item" and can't be given to anyone but Alex Morgan

### AC3: The API only allows clearing it
Given that kept allocation of Mic 1 to Sam Patel in "Finale"
When a request changes its cast member or role, however it's made
Then it is refused
And a request to clear it is accepted

### AC4: Nothing is removed by itself
Given that kept allocation
When anyone opens the Mic plot page or the Overview, or the running order is saved again unchanged
Then Mic 1 in "Finale" is still Sam Patel's until someone clears it

## Notes

- FRs: FR10
- Depends on: production-mics.E2.S1
- Decided 2026-11-02: kept, clearable only, never freed automatically (PRD Resolved). No warning icon (PRD non-goals); the channel's clear-only state is in its accessible name.
- Out of scope: casting changes (E2.S3).
