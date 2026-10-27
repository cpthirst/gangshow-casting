---
id: production-overview.E2.S2
title: Add a button for every department to each Overview row
epic: E2
status: ready
---

## Story

As someone on the production team, I want a button on each item for Scenery, Props, SFX, Mic plot and Wardrobe, so that every department's page for an item is one click from the same list.

## Acceptance criteria

### AC1: Five buttons, in order
Given a saved running order with "Opening Number"
When someone opens the Overview
Then the row has five square buttons, Scenery, Props, SFX, Mic plot and Wardrobe, in that order
And each has its own icon: a hammer, a person walking with luggage, an audio file, a microphone and a shirt

### AC2: Each button is named for its department, item and access
Given "pat" has Tech but not Stage or Wardrobe
When pat reaches the buttons for "Opening Number" with a screen reader
Then they're named "View scenery for Opening Number", "View props for Opening Number", "Edit SFX for Opening Number", "Edit mic plot for Opening Number" and "View wardrobe for Opening Number"
And each shows its department's name as a tooltip on hover and focus

### AC3: An admin edits every department
Given an admin
When they open the Overview
Then every button on every row is named "Edit …"

### AC4: A department's button opens its page for the item
Given someone on the Overview
When they choose Mic plot on "Opening Number"
Then they're on the mic plot page for Opening Number, which shows the item's name and position in the running order
And it says "Coming soon"

### AC5: Each department has an item page
Given someone on the Overview
When they choose Scenery, SFX or Wardrobe on "Opening Number"
Then each opens that department's page for Opening Number, titled for the department and the item, saying "Coming soon"

### AC6: Item pages link back, previous and next
Given someone on the SFX page for item 2 of 3
When they use the page's links
Then one goes back to the Overview
And Previous and Next go to the SFX pages for items 1 and 3
And there's no Previous on the first item, and no Next on the last

### AC7: An unknown item says not found
Given an address for the Wardrobe page of an item that isn't in the latest saved running order
When someone opens it
Then it shows a "not found" message with a link back to the Overview

### AC8: Every role can open every page
Given "jo" has no permissions
When jo chooses each of the five buttons on an item
Then each page opens

### AC9: The row fits a phone
Given the Overview at 320px and at 360px wide
When someone looks at a row with a long title
Then the five buttons and the props count fit without the page scrolling sideways

## Notes

- Add a browser layout walk of the Production overview (`/production/overview`) at 320px and 360px, with all five buttons in each row (agreed with the maintainer 2026-10-27, when E2.S1 shipped without one).

- FRs: FR4, FR5, FR10
- Depends on: production-overview.E2.S1
- Departments, for the edit or view name: Scenery and Props are Stage, SFX and Mic plot are Tech, and Wardrobe is Wardrobe (PRD constraints).
- Icons come from the Font Awesome set the app already uses (ADR 0013), and are hidden from screen readers. Chosen by the maintainer 2026-10-27: Scenery `hammer`, Props `person-walking-luggage`, SFX `file-audio`, Mic plot (radio mics) `microphone`, Wardrobe `shirt`.
- **No icon legend**: the tooltips and the Help page (E3.S1) name each icon, as the PRD's open question left to this story. Revisit if `ux-reviewer` or the team find the icons unclear.
- The four new item pages share one layout and the item-step links (back, Previous, Next) that the casting and props item pages use. Each department's feature later replaces "Coming soon" with its own content, and decides then whether to add a count column or an export.
- AC9 is checked by the browser layout tests, which may need to walk the new item pages. Ask before adding a walk (CLAUDE.md).
- Out of scope: any Scenery, SFX, Mic plot or Wardrobe content, and the Mic Plot (Excel) and SFX List (Word) exports.
