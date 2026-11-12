---
id: production-costume-sheets.E2.S2
title: Generate a costume sheet for every cast member
epic: E2
status: ready
---

## Story

As someone on the Wardrobe team, I want one Word document with a costume sheet for every cast member, so that I can print and hand each person what they are given and what to bring, without writing it out by hand.

## Acceptance criteria

### AC1: Generate Costume Sheets sits with the other exports
Given a production with a saved running order
When anyone signed in, a Read-Only Team Member included, opens the Production Overview
Then there is a "Generate Costume Sheets" button beside "Generate Props List" and "Generate Mic Plot", with the Word export icon

### AC2: One page per cast member, laid out as the casting sheets
Given the cast is Alex Morgan (Scouts, 1st Anytown), Jo Brown (Explorers, Anytown Unit) and Sam Patel (no section), and Sam is cast in nothing
When anyone chooses Generate Costume Sheets
Then a Word document downloads, named for the production and the date, with a page each for Alex, then Jo, then Sam, each starting on a new page and headed with the production's title, then the cast member's name, then their section and group, and nobody else's details

### AC3: The five columns
Given the same production
When the costume sheets are generated
Then each page's table has the columns "#", "Item Name", "Role", "From Wardrobe" and "From Cast Member", one row per item in show order with the programme number in "#" and a break between the halves, and an item left out of the printed programme with no number and its name in the grid's red italics

### AC4: A row shows the cast member's role and costume for the item
Given Alex Morgan as "Captain Hook" in "Opening Number" has From Wardrobe "Red coat, hook", From Cast Member "Black shoes" and Notes "Hem the coat", and Alex isn't in "Pirate Dance"
When the costume sheets are generated
Then Alex's "Opening Number" row shows "Captain Hook", "Red coat, hook" and "Black shoes", and never "Hem the coat"
And Alex's "Pirate Dance" row has "Role", "From Wardrobe" and "From Cast Member" empty

### AC5: Two roles in one item are two rows
Given Jo Brown is both "Smee" and in "Pirates" in "Opening Number"
When the costume sheets are generated
Then Jo's page has two "Opening Number" rows, one for "Smee" and one for "Pirates", each with its own costume text

### AC6: Busy, done and failed, as the other exports
Given anyone is on the Production Overview
When they choose Generate Costume Sheets
Then the button shows it is busy and can't be pressed again until it finishes, screen readers are told "Costume sheets generated." when it does
And if it fails, a line says the costume sheets couldn't be generated and to try again, and the button works again

### AC7: The Usage page records it
Given "kit" generates the costume sheets
When an admin opens the Usage page
Then kit's account shows the costume sheets export, as it shows the other exports

## Notes

- FRs: FR9, FR10, FR11, FR14
- Depends on: production-costume-sheets.E1.S2, production-costume-sheets.E2.S1
- The costume sheets and the casting sheets are one document with two column sets, sharing the page order, headings, half breaks, row height, unprinted-item styling and margins (ADR 0022). Extend that document; don't copy it.
- Built in the browser from the cast, roles, running order and every item's costumes, loading only when used, as the other Word exports.
- The Help entry for the button is E3.S1's; this story adds nothing to Help.
- Out of scope: a by-item costume list (PRD non-goal).
