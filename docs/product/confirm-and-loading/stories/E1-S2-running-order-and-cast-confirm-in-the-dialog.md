---
id: confirm-and-loading.E1.S2
title: The Running order and Cast pages confirm in the dialog
epic: E1
status: ready
---

## Story

As an admin rearranging the show or updating the cast, I want the Running order's and Cast page's confirmations in iCUE's own dialog, with a button that says what it does, so that I can't confuse removing or saving with keeping things as they are.

## Acceptance criteria

### AC1: Removing an item from the running order asks in the dialog
Given an admin on the Running order with Pirate Sketch in it
When they choose "Remove from the running order" on Pirate Sketch
Then the dialog asks the question the page asks today, naming Pirate Sketch and what saving will also remove
And its buttons are "Remove item" and "Cancel"
And "Cancel" leaves Pirate Sketch in the draft, while "Remove item" takes it out

### AC2: Saving a draft that moves items between gangs asks in the dialog
Given an admin has moved an item to the other gang, taking someone out of a role
When they choose "Save as Draft 4"
Then the dialog asks the question the page asks today
And its buttons are "Save as Draft 4" and "Cancel"
And "Cancel" saves nothing and keeps the draft as it is

### AC3: Leaving the Running order with unsaved changes asks in the dialog
Given an admin has unsaved changes to the running order
When they choose another page from the menu
Then the dialog asks "Discard unsaved changes?" with "Discard changes" and "Cancel"
And "Cancel" keeps them on the Running order with their changes
And "Discard changes" takes them to the page they chose

### AC4: Deleting a cast member asks in the dialog
Given an admin on the Cast page, where Alfie Applebottom has two roles
When they choose "Delete from the cast" on Alfie Applebottom
Then the dialog asks the question the page asks today, naming Alfie and his two roles
And its buttons are "Delete cast member" and "Cancel"
And "Cancel" keeps Alfie in the cast

### AC5: Changing a member's section to the other gang asks in the dialog
Given an admin editing Alfie Applebottom, who is in the Senior cast, changes his section to Cubs, taking him out of his roles
When they choose "Save"
Then the dialog asks the question the page asks today
And its buttons are "Save" and "Cancel"
And "Cancel" saves nothing and keeps the form open as it was

## Notes

- FRs: FR1, FR2, FR5
- Depends on: E1.S1
- Each question stays word for word. Each existing test that stubbed the browser's confirm box answers the dialog through E1.S1's shared test helper instead.
- The dialog's own behaviour (Escape, tap outside, focus, announcement) is E1.S1's, tested there.
- Closing the tab with unsaved changes still uses the browser's own prompt (PRD non-goal).
