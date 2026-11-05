---
id: production-mics.E2.S2
title: Keep an allocation a reorder makes break the rule, clearable only and flagged as an error
epic: E2
status: done
---

## Story

As someone in the Tech team, I want an allocation that a running order change has made impossible to stay visible and flagged as an error until I clear it, so that nothing I planned disappears without me seeing it, and I can see what needs fixing.

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

### AC5: The kept allocation shows an Error icon on the item's page
Given that kept allocation of Mic 1 to Sam Patel in "Finale"
When anyone signed in opens the Mic plot page for "Finale"
Then Mic 1 shows an Error icon, the same icon as a casting clash
And when they hover over or focus it, they see "Error: back-to-back mic. Mic 1 is Alex Morgan's in 'Opening Number', then Sam Patel's in 'Finale'"
And no other channel in "Finale", and no channel in "Opening Number", shows an icon

### AC6: The error is read out in words and written out on phones
Given Mic 1 in "Finale" shows the Error icon
When a screen reader or keyboard user reaches it
Then it can be focused, and is read as the word "Error" followed by the full description
And on a phone the description is written out under Mic 1, with no hover or tap needed, and the page doesn't scroll sideways

### AC7: Clearing it, or moving the items apart, removes the error
Given that kept allocation of Mic 1 to Sam Patel in "Finale"
When someone with Tech clears it, or the running order is saved with another item between "Opening Number" and "Finale"
Then Mic 1 in "Finale" has no icon

## Notes

- FRs: FR10
- Depends on: production-mics.E2.S1
- Decided 2026-11-02: kept, clearable only, never freed automatically (PRD Resolved). The channel's clear-only state is in its accessible name.
- Decided 2026-11-05 (user): a kept allocation that breaks the rule is flagged as an Error, following the casting clash pattern (casting-rules E2.S1): the shared `ClashIcon`, "Severity: kind. detail" wording naming both items, focusable, written out on phones. This is the only icon on the Mic plot page; a greyed-out channel still has none (PRD non-goals). Only the later item's channel is flagged: the earlier allocation is fine.
- The Overview's Error icon is in production-mics.E3.S1, since the Mic plot column arrives there.
- AC2's "reads 'Used in previous item'" is E2.S1's greying: greyed when Alex isn't cast in the item; when Alex is, only Alex is offered, as E2.S1 AC2.
- Decided 2026-11-05 (user, from ux-reviewer): the Error icon sits beside who is on the channel, as a clash's is by the name; a kept channel's disabled picker is grey, as a held one's; and it says "Used by Alex Morgan in previous item" in words, for everyone, as a held channel says why.
- Browser layout tests: AC6's phone write-out is a candidate for a walk; ask the user before adding one.
- Out of scope: casting changes (E2.S3).
