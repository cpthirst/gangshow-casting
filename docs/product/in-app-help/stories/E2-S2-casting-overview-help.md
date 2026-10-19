---
id: in-app-help.E2.S2
title: Help for the Casting overview
epic: E2
status: draft
---

## Story

As a creative team reviewer looking at casting, I want the Overview's views, exports and clash icons explained, so that I can switch to the view I need and take a copy away.

## Acceptance criteria

### AC1: An Overview section on Welcome
Given "jo" is signed in as a Read-Only Team Member
When jo opens the Welcome page
Then there is an "Overview" section after the Cast section, with a link to the Overview page

### AC2: A line per action
Given jo is on the Welcome page
When jo reads the Overview section
Then it has one short line for each of: the By person, By item and Grid views, Export to Excel (on the Grid), Export to Word (on By person and By item), and the clash icon
And the export lines show the same icons as their buttons, and the clash line shows a clash icon

### AC3: Everyone can use all of it
Given jo is reading the Overview section
When jo looks at each line's label
Then every line says "Everyone"

### AC4: It's short
Given the Overview section
When it's shown
Then it has no more than 8 lines about actions

### AC5: The help button opens the same help
Given jo is on the Overview page
When jo presses "Help for Overview"
Then a dialog titled "Overview help" opens, showing the same lines and labels as the Overview section of the Welcome page

### AC6: The chosen view survives
Given jo has switched the Overview to "Grid"
When jo opens the Overview help and closes it again
Then the Overview still shows the Grid

## Notes

- FRs: FR3, FR4, FR5, FR6, FR7, FR9
- Depends on: in-app-help.E1.S2 (the help button and dialog)
- The Overview's heading already sits in a title row (`page-title-row`), so the help button goes there.
- Exports are open to every role (ADR 0021, ADR 0022).
- The clash line explains what the icon means (people in back-to-back items, for example) in a few words, not every clash rule.
- Out of scope: the Items list and single item (E2.S3).
