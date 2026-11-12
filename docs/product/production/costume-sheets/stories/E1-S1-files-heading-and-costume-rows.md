---
id: production-costume-sheets.E1.S1
title: Head the files, and list who wears what on the Wardrobe page
epic: E1
status: done
---

## Story

As someone on the Wardrobe team, I want each item's Wardrobe page to list every cast member in every role in the item, so that I can see at a glance who I'm dressing for it.

## Acceptance criteria

### AC1: The three file pages head their files "Files"
Given "Opening Number" has "jacket-pattern.pdf" in its Wardrobe files, "set-plan.pdf" in scenery and "thunder.mp3" in SFX
When anyone signed in opens its Wardrobe, Scenery or SFX page
Then each page's files, and its upload area for those who can change it, sit under a heading "Files"
And nothing else about the three pages changes

### AC2: The Wardrobe page has a Costumes section between its files and notes
Given "Opening Number" is in the running order
When anyone signed in opens its Wardrobe page
Then under Files there is a section headed "Costumes", and under that the "Wardrobe notes"

### AC3: A row per cast member per role
Given "Opening Number" has the roles "Captain Hook" (lead) played by Alex Morgan, and "Pirates" (ensemble) played by Jo Brown, Kim Lee and Sam Patel
When anyone signed in opens its Wardrobe page
Then Costumes lists four rows: "Captain Hook" with Alex Morgan, then "Pirates" with Jo Brown, "Pirates" with Kim Lee and "Pirates" with Sam Patel
And the roles are in the item's role order and, within "Pirates", the cast members are in the order the casting item page shows them

### AC4: An uncast role shows one row saying so
Given "Opening Number" has the role "Smee" (support) with nobody cast in it
When anyone signed in opens its Wardrobe page
Then Costumes has one row for "Smee" marked uncast, with no cast member and nothing to edit

### AC5: An item with no roles says nobody is cast
Given "Interval Music" has no roles
When anyone signed in opens its Wardrobe page
Then Costumes says that nobody is cast in the item yet, and lists no rows

### AC6: The rows read the current casting
Given "Opening Number" shows "Captain Hook" with Alex Morgan
When "Captain Hook" is recast to Chris Evans on the casting page and the Wardrobe page is opened again
Then Costumes shows "Captain Hook" with Chris Evans, and Alex Morgan no longer appears for it

### AC7: Stepping to the next item shows its own rows
Given "Opening Number" has four costume rows and the next item, "Pirate Dance", has one
When anyone on Opening Number's Wardrobe page chooses Next
Then Costumes shows Pirate Dance's one row, and the page keeps its link back to the Overview and its Previous and Next links

## Notes

- FRs: FR2, FR3
- Depends on: none
- The rows show the role's name and the cast member's name as a prop card shows its roles and carriers (production-props FR18), and should share that piece rather than copy it. The Wardrobe page is `ItemFiles` with a department; the Costumes section is what makes Wardrobe differ from Scenery and SFX, so the shared piece gains a place for it rather than Wardrobe getting its own copy of the files.
- The rows come from the casting the page already has reach to (roles and cast); no new API route.
- AC7 is met by the shared item frame; it needs a check that the rows are wired to the item, not a second full test.
- Out of scope: the three fields and editing (E1.S2), Help (E3.S1).
