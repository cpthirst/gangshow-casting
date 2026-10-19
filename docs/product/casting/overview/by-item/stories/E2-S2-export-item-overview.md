---
id: casting-overview-by-item.E2.S2
title: Export the By item view as a Word document
epic: E2
status: ready
---

## Story

As a member of the production team, I want to export the By item view as a Word document, so that item leaders and the creative team can read or print the show's casting.

## Acceptance criteria

### AC1: The button shows on the By item view
Given I am on the Overview showing "By item"
When I look beside the view switch
Then there is a blue "Export Item Overview" button, shaped like "Export to Excel", with a file icon and the words

### AC2: The button shows on no other view
Given I am on the Overview showing "By person" or "Grid"
Then there is no "Export Item Overview" button

### AC3: Every team role can export
Given I am signed in as an Admin, a Casting Team Member or a Read-Only Team Member
When I press "Export Item Overview"
Then a Word document downloads

### AC4: The document is named for the production and the day
Given the production "Gang Show 2027" and today is 12 March 2027
When I export
Then the file is named "Gang Show 2027 item overview 2027-03-12.docx"

### AC5: The headings follow the show
Given a running order titled "Gang Show 2027", whose first half "Act One" has item 1 "Opening"
When I open the document in Word
Then "Gang Show 2027" is Heading 1, "Act One" is Heading 2 and "1 Opening" is Heading 3
And Word's navigation pane lists them as that outline

### AC6: Each item has its roles table
Given "Opening" has a lead role "Fairy Godmother" played by Ava Example, and an ensemble "Villagers" played by Ben Sample and Cara Test
When I open the document
Then under "1 Opening" is a table with a header row "Role name", "Role type", "Cast"
And rows "Fairy Godmother", "Lead", "Ava Example" and "Villagers", "Ensemble", "Ben Sample, Cara Test", in the view's order

### AC7: Unprinted items, uncast roles and empty items match the screen
Given an unprinted item "Scene Change Music", an uncast role "Narrator" and an item "Finale" with no roles
When I open the document
Then "Scene Change Music" is a Heading 3 in red italics with no number, the "Narrator" row reads "Uncast", and "Finale" says no roles have been added yet

### AC8: The document holds only what the screen shows
Given a cast member with an age band and Singing and Acting notes
When I export
Then the document contains none of them

### AC9: The button shows it's busy
Given I have pressed "Export Item Overview"
When the document is still being made
Then the button shows it's busy and pressing it again starts no second export
And when it finishes, keyboard focus is back on the button

### AC10: A finished export is announced
Given I pressed "Export Item Overview"
When the document has downloaded
Then screen readers hear "Item overview exported."

### AC11: A failed export says so and can be retried
Given making the document fails
When I press "Export Item Overview"
Then I see "Couldn't export the item overview. Try again." and the button works again

### AC12: The document reflects the latest saved casting
Given someone added a role to "Opening" after I opened the Overview
When I export
Then the document includes that role

## Notes

- FRs: FR7, FR8, FR14, FR15
- Depends on: E1.S2, E2.S1 (the ADR decides where the document is built, which shapes AC3 and AC12)
- Busy, announcement and failure follow the Excel export's behaviour on the grid.
- Tests use made-up names only.
- Out of scope: the casting sheets (E2.S3, E2.S4).
