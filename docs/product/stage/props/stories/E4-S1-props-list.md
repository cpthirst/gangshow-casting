---
id: stage-props.E4.S1
title: List the show's items in the Props view
epic: E4
status: ready
---

## Story

As someone on the props team, I want the Stage page's Props view to list the show's items in running order with how many props each has, so that I can see the whole show's props at a glance and open any item.

## Acceptance criteria

### AC1: Items are listed in running order, by half
Given the latest saved running order has "Opening Number" (item 1) and "Pirate Sketch" (item 2) in the first half, and "Finale" (item 14) in the second
When anyone opens Production → Stage and chooses its Props view
Then each half is listed under its name, with its items in order, as on Casting Items

### AC2: Each row shows its columns
Given the running order above
When the Props page is open
Then the columns are headed Props, #, Item and Props count, with no minutes column
And each row shows the item's number and title

### AC3: Items not in the printed programme are marked
Given "Interval Announcement" is in the running order but not in the printed programme
When the Props page is open
Then its number is blank, and its title is marked "Not in printed programme", as on Casting Items

### AC4: The props count has a label
Given "Pirate Sketch" has 3 props and "Finale" none
When the Props page is open
Then Pirate Sketch shows 3 props and Finale shows 0, each with a text label, not a bare number

### AC5: With Stage, the first column edits
Given "pat" has the Stage permission
When pat opens the Props page
Then each row's first column has a pencil button named "Edit props for Pirate Sketch" (and so on), which opens that item's props page

### AC6: Without Stage, the first column views
Given "sam" has the Casting permission only
When sam opens the Props page
Then each row's first column has a view button named "View props for Pirate Sketch", which opens that item's props page
And the page shows the line "You have read-only access"

### AC7: No saved running order
Given the production has no saved running order
When anyone opens the Props page
Then it says there's no running order yet and links to the Running order page

### AC8: A failed load isn't shown as an empty show
Given the running order can't be loaded
When the Props page is opened
Then it says it couldn't load the items, not that there's no running order

### AC9: Props counts that can't be loaded
Given the running order loads but the props can't be loaded
When the Props page is opened
Then the items still show, with a message that the props counts couldn't be loaded, and no count reads 0

## Notes

- FRs: FR13, FR15
- "The Props page" in these ACs means the Stage page's Props view (PRD FR13). It replaces that view's "Coming soon" from E3.S1.
- Depends on: stage-props.E1.S2, stage-props.E3.S1
- This story adds reading a production's props from the API, scoped to the production, so the counts are real. They're all 0 until props can be added (E4.S2), and tests can seed props.
- The props data is the production's own, apart from casting, and holds no cast data of its own: a prop links to roles (E4.S3).
- The item's props page is reached from here. Until E4.S2 builds it, the button may open a placeholder.
- Accessibility: the pencil and view buttons have accessible names that include the item. The page works at 320px and 360px. Ask before adding it to the browser layout walks (CLAUDE.md).
- Out of scope: props notes under each row (E4.S5), and the export (E5.S1).
