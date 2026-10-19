---
id: in-app-help.E2.S1
title: Help for the Cast page
epic: E2
status: draft
---

## Story

As a volunteer keeping the cast list up to date, I want the Cast page's buttons explained on the Welcome page and behind the page's help button, so that I know how to find, add and change people and which of that my account allows.

## Acceptance criteria

### AC1: A Cast section on Welcome
Given "sam" is signed in as a Casting Team Member
When sam opens the Welcome page
Then there is a "Cast" section after the Running order's, with a link to the Cast page

### AC2: A line per action
Given sam is on the Welcome page
When sam reads the Cast section
Then it has one short line for each of: filtering by first name, last name or section, Clear filters, Add cast member, editing someone, and deleting someone
And the editing and deleting lines show the same icons the Cast page uses

### AC3: Who can use each
Given sam is reading the Cast section
When sam looks at each line's label
Then filtering and Clear filters say "Everyone"
And Add cast member and editing say "Casting team and admins"
And deleting says "Admins only"

### AC4: It's short
Given the Cast section
When it's shown
Then it has no more than 8 lines about actions

### AC5: The help button opens the same help
Given sam is on the Cast page
When sam presses "Help for Cast"
Then a dialog titled "Cast help" opens, showing the same lines and labels as the Cast section of the Welcome page

### AC6: An open form survives
Given sam has started adding a cast member and typed "Ava" as the first name
When sam opens the Cast help and closes it again
Then the form is still open with "Ava" as the first name

## Notes

- FRs: FR3, FR4, FR5, FR6, FR7, FR9
- Depends on: in-app-help.E1.S2 (the help button and dialog)
- The dialog's focus and closing behaviour is E1.S2's. Reuse it; don't test it again here.
- Out of scope: the Casting pages (E2.S2, E2.S3).
