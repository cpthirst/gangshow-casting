---
id: junior-cast.E1.S1
title: Record Beavers and Cubs as sections
epic: E1
status: done
---

## Story

As someone who keeps the cast list, I want to record a cast member's section as Beavers or Cubs, so that the Junior cast is in iCUE alongside the Senior cast.

## Acceptance criteria

### AC1: A cast member can be added as a Beaver
Given the Cast page for the 2027 production
When someone who can edit the cast adds "Poppy Example" with section Beavers
Then the cast list shows Poppy Example with section Beavers

### AC2: A cast member can be changed to Cubs
Given "Ollie Sample" has no section
When someone who can edit the cast changes their section to Cubs and saves
Then the cast list shows Ollie Sample with section Cubs

### AC3: A section outside the list is refused
Given the cast API
When a client adds a cast member with section "squirrels"
Then the request is refused as invalid
And no cast member is added

### AC4: The section filter offers Beavers and Cubs
Given "Poppy Example" (Beavers), "Ollie Sample" (Cubs) and "Sam Specimen" (Scouts)
When someone filters the Cast page by section Cubs
Then only Ollie Sample is listed

### AC5: The Casting overview groups the Junior sections, youngest first
Given cast members in Beavers, Cubs, Scouts, Explorers and Network, and one with no section
When someone opens the Casting overview
Then its sections are, in order: Beavers, Cubs, Scouts, Explorers, Network, Not set

### AC6: The overview's Excel export includes the Junior sections
Given "Poppy Example" (Beavers) and "Ollie Sample" (Cubs)
When someone exports the Casting overview to Excel
Then Poppy Example's row shows section Beavers and Ollie Sample's shows Cubs

### AC7: The overview's Word export includes the Junior sections
Given "Poppy Example" (Beavers)
When someone exports the Casting overview to Word
Then Poppy Example is listed under Beavers

## Notes

- FRs: FR1, FR7 (section filter), FR8, FR9
- Depends on: none
- The list of sections, their labels and their order are kept in one place that the form, the filter, the Overview and both exports read (FR9). The Overview's "Not set" stays last.
- Amend ADR 0010 (via the `adr` skill) to add Beavers and Cubs. The Junior cast are younger children, from 6, and no new kinds of data are stored. Update the safeguarding rule's section list in CLAUDE.md and the README to match. This story records no Junior cast until the amendment is in.
- The Group field stays "Scout group or Explorer unit". Beavers and Cubs belong to Scout groups.
- Use made-up names only.
- Out of scope: the Junior/Senior filter (E1.S2); items and casting (E2).
