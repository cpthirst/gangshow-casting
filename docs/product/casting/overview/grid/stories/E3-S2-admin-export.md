---
id: casting-overview-grid.E3.S2
title: Export the grid to Excel as an admin
epic: E3
status: ready
---

## Story

As an admin, I want to export the casting grid to Excel, so that I can take it to planning meetings, share it with the team and print it.

## Acceptance criteria

The examples use the production "Pirates 2027", the running order and cast from casting-overview-grid.E2.S1, and an export on 12 March 2027.

### AC1: Admins see the button
Given I am signed in as an admin
When the Overview is showing the grid
Then I see an "Export to Excel" button

### AC2: Other users do not
Given I am signed in as a member who is not an admin
When the Overview is showing the grid
Then there is no "Export to Excel" button

### AC3: The button is not on the by-person view
Given I am an admin
When the Overview is showing people by section
Then there is no "Export to Excel" button

### AC4: The file opens in Excel
Given I am an admin
When I choose "Export to Excel"
Then a `.xlsx` file downloads that opens in Microsoft Excel

### AC5: The file is named for the production and date
Given the production "Pirates 2027" and the date 12 March 2027
When I export
Then the file is named "Pirates 2027 casting grid 2027-03-12.xlsx"

### AC6: Rows and columns match the grid
Given the cast and running order in casting-overview-grid.E2.S1
When I export
Then each row is first name, last name and section for Sam Example, Alex Sample and Jo Newcomer in the grid's order
And the item columns run "1 · Opening Number", "2 · Pirate Sketch", "3 · Dance One"

### AC7: Filled cells hold the role-size letter
Given Sam is a lead in "Pirate Sketch" and a cameo in "Dance One"
When I export
Then Sam's "Pirate Sketch" cell holds L and his "Dance One" cell holds C
And an ensemble part holds E
And cells with no casting are blank

### AC8: Several roles in one item export the biggest
Given Sam is a lead and a cameo in "Pirate Sketch"
When I export
Then that cell holds L only

### AC9: No other cast data
Given cast members with a group, age band, casting notes and role names
When I export
Then the file holds only first name, last name, section and the role-size letters

### AC10: The server refuses non-admins
Given I am signed in as a member who is not an admin
When I ask the export route directly
Then it refuses me and no file is returned

### AC11: The server refuses anyone not signed in
Given I am not signed in
When I ask the export route
Then it refuses me and no file is returned

### AC12: A failed export says so
Given I am an admin and the export fails
When I choose "Export to Excel"
Then I see a message that the export did not work and I can try again

### AC13: A reminder the file is team-only
Given I am an admin
When I look at the "Export to Excel" button
Then a short note beside it says the file holds the cast's names and is for the production team only

## Notes

- FRs: FR12, FR13, FR14
- Depends on: casting-overview-grid.E2.S1, casting-overview-grid.E3.S1
- The export matches the grid, ensemble E included.
- Use made-up names only in tests and fixtures. Check the file contents by reading it back in a test.
- If this runs over ~400 changed lines, split the route from the button and update the story map.
- Out of scope: cell colour fills (E3.S3).
