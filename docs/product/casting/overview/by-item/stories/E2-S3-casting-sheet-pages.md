---
id: casting-overview-by-item.E2.S3
title: Export a casting sheet page per cast member
epic: E2
status: done
---

## Story

As a member of the production team, I want to export a Word document with a page for every cast member, so that I can print one and hand it to each young person.

## Acceptance criteria

### AC1: The button shows on the By person view
Given I am on the Overview showing "By person"
When I look beside the view switch
Then there is a blue "Export to Word" button, shaped like "Export to Excel", with a file icon and the words

### AC2: Each view's button makes its own document
Given I am on the Overview showing "By item"
When I press "Export to Word"
Then I get the Item Overview, not the casting sheets
And on "Grid" there is no "Export to Word" button

### AC3: Every team role can export
Given I am signed in as an Admin, a Casting Team Member or a Read-Only Team Member
When I press "Export to Word"
Then a Word document downloads

### AC4: The document is named for the production and the day
Given the production "Gang Show 2027" and today is 12 March 2027
When I export
Then the file is named "Gang Show 2027 casting sheets 2027-03-12.docx"

### AC5: There is one page per cast member, including people with no parts
Given a cast of Ava Example (in two items), Ben Sample (in one) and Cara Test (in none)
When I open the document
Then it has three pages, one for each of them, each starting on a new page

### AC6: Pages are ordered by section, then surname, then first name
Given Explorers Zoe Adams, Scouts Tom Brown and Amy Brown, Network Sam Clark, and Dan Evans with no section set
When I open the document
Then the pages are in the order Amy Brown, Tom Brown, Zoe Adams, Sam Clark, Dan Evans

### AC7: Each page has a heading for the show and the person
Given Ava Example is a Scout in "1st Anytown"
When I open the document
Then her page starts with the heading "Gang Show 2027", then "Ava Example" and "Scouts · 1st Anytown"

### AC8: A person with no group or section still gets a clean heading
Given Dan Evans has no section and no group set
When I open the document
Then his page shows "Dan Evans" with no empty separators or placeholder text

### AC9: The document holds only the allowed fields
Given a cast member with an age band and Singing and Acting notes
When I export
Then the document contains none of them

### AC10: The button shows it's busy, announces success and reports failure
Given I press "Export to Word"
When the document is being made, then finishes or fails
Then the button shows it's busy and can't start a second export, screen readers hear "Casting sheets exported." on success, and a failure shows "Couldn't export the casting sheets. Try again." with the button working again

### AC11: An empty cast exports nothing
Given the production has no cast members
When I look at the By person view
Then there is no "Export to Word" button

## Notes

- FRs: FR7, FR9, FR10, FR11, FR14, FR15
- Depends on: E2.S2 (reuses its document building and button behaviour)
- Section order: Scouts, Explorers, Network, then no section set, as on the grid.
- Out of scope: the items table on each page (E2.S4).
