---
id: in-app-help.E2.S3
title: Help for the Items list and a single item
epic: E2
status: ready
---

## Story

As a casting team volunteer casting an item, I want the Items list and the item page explained, so that I know how to get to an item, step between items, and add and change its roles and notes.

## Acceptance criteria

### AC1: Items and item sections on Welcome
Given "sam" is signed in as a Casting Team Member
When sam opens the Welcome page
Then there is an "Items" section after the Overview's, with a link to the Items page
And an "An item" section after it

### AC2: The Items section's lines
Given sam is reading the Items section
When sam reads its lines
Then it has one short line for each of: opening an item to cast or view it, the clash icon, and the "Not in printed programme" badge
And the opening line shows the same icon the Items page uses
And every line says "Everyone"

### AC3: The item section says how to get there
Given sam is reading the "An item" section
When sam reads its first line
Then it says an item is opened from Casting → Items
And the section links to the Items page, since an item has no menu entry of its own

### AC4: The item section's lines
Given sam is reading the "An item" section
When sam reads its lines
Then it has one short line for each of: All items, Previous and Next, Add role, editing a role, removing a role, and the item's notes
And the editing and removing lines show the same icons the item page uses

### AC5: Who can use each on an item
Given sam is reading the "An item" section
When sam looks at each line's label
Then All items, Previous and Next say "Everyone"
And Add role, editing a role and removing a role say "Casting team and admins"
And the notes line says reading them is for everyone and changing them is for the casting team and admins

### AC6: They're short
Given the Items and "An item" sections
When each is shown
Then neither has more than 8 lines about actions

### AC7: Each page's help button opens its own help
Given sam is on the Items page, then on the item "Opening Number"
When sam presses each page's help button
Then the Items page opens "Items help" with the Items section's lines
And the item opens "Item help" with the "An item" section's lines, including how to reach it

### AC8: An item's unsaved notes survive
Given sam has typed "Needs a quick change" into "Opening Number"'s notes without saving
When sam opens the item's help and closes it again
Then the notes still say "Needs a quick change"

### AC9: Help on an unknown item
Given sam opens an item that doesn't exist, so the page says "Item not found"
When sam looks at the top of the page
Then there is no help button

## Notes

- FRs: FR3, FR4, FR5, FR6, FR7, FR9, FR10
- Depends on: in-app-help.E1.S2 (the help button and dialog)
- The item page's help button is named "Help for this item". The item page's title changes with each item, so it can't name the page.
- The notes line has two access levels in one line (AC5). That's deliberate: it's one thing on the page.
- Check the PR size: two pages of help. Split the item page into its own story if it nears ~400 lines.
- Out of scope: Accounts (non-goal).
