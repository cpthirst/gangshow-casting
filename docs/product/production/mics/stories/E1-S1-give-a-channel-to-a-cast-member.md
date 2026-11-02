---
id: production-mics.E1.S1
title: Give a mic channel to a cast member in the item
epic: E1
status: ready
---

## Story

As someone in the Tech team, I want each item's Mic plot page to list all 24 radio mic channels and let me give each one to a cast member in that item, so that the mic plot lives with the running order and the casting instead of a hand-typed spreadsheet.

## Acceptance criteria

### AC1: All 24 channels are listed
Given "Opening Number" has no mics given out
When anyone signed in opens its Mic plot page
Then it lists Mic 1 to Mic 24, in order, each empty
And "Coming soon" is gone
And the link back to the Overview and the Previous and Next links are still there

### AC2: Tech gives a channel to a cast member in the item
Given "Alex Morgan" and "Sam Patel" are cast in "Opening Number", and "Jo Reed" is not
When someone with Tech chooses a cast member for Mic 3
Then they can choose Alex Morgan or Sam Patel, but not Jo Reed
And after choosing Alex Morgan, Mic 3 shows "Alex Morgan" for everyone who opens the page

### AC3: A channel can be cleared
Given Mic 3 in "Opening Number" is given to Alex Morgan
When someone with Tech clears it
Then Mic 3 is empty for everyone

### AC4: A cast member is on only one channel in an item
Given Alex Morgan is on Mic 3 in "Opening Number"
When someone with Tech chooses a cast member for Mic 4
Then Alex Morgan isn't offered

### AC5: Director and Admins can change it too
Given an account with Director only, and an Admin account
When either gives Mic 5 in "Opening Number" to Sam Patel
Then the change is saved

### AC6: Everyone else sees it read-only
Given an account with Casting, Stage and Wardrobe but not Tech or Director
When they open the Mic plot page for "Opening Number"
Then they see every channel and who is on it, with no way to change them
And the line says what can be viewed but not changed, and that Tech, Director and Admins can change it

### AC7: The API refuses changes outside the rules
Given Alex Morgan is on Mic 3 in "Opening Number", and Jo Reed isn't cast in it
When a request, however it's made, gives a channel without Tech, Director or Admin, or gives a channel to Jo Reed, or gives Mic 4 to Alex Morgan, or gives Mic 25 or Mic 0
Then each is refused and nothing changes

### AC8: Not signed in, nothing is shown
Given someone who isn't signed in
When they ask the API for an item's mic plot or to change it
Then they are refused

### AC9: An item that isn't in the running order
Given an item id that isn't in the latest saved running order
When someone opens its Mic plot page
Then they see the not-found message with a link back to the Overview

### AC10: The mic plot leaves with its item
Given "Old Sketch" has Mic 1 given to Alex Morgan
When "Old Sketch" is removed from the running order and the running order is saved
Then its mic plot is deleted
And if the clean-up fails, the next save deletes it

## Notes

- FRs: FR1, FR2, FR3 (cast member), FR4, FR11
- Depends on: none
- The mic plot belongs to the item in the current production and goes with it when it moves (FR11).
- Channel pickers are labelled "Mic 3 cast member" and so on; the page works at 320px and 360px with no sideways scrolling (PRD accessibility).
- Ask before adding a browser layout walk for the page (CLAUDE.md).
- Out of scope: roles (E1.S2), notes (E1.S3), the item-before rule (E2.S1), the Overview count (E3.S1).
