---
id: confirm-and-loading.E1.S1
title: Confirm on item pages in iCUE's own dialog
epic: E1
status: ready
---

## Story

As a Casting volunteer on a phone, I want removing a role, and leaving notes I haven't saved, to ask in iCUE's own dialog with a button that says what it does, so that I can see at a glance which button removes the role and which keeps it.

## Acceptance criteria

### AC1: Removing a role asks in the dialog
Given an admin on "Casting: Pirate Sketch", which has the role Captain Blackbeard
When they choose Remove on Captain Blackbeard
Then a dialog asks "Remove the role Captain Blackbeard from Pirate Sketch? Anyone cast in it will be uncast."
And its buttons are "Remove role" and "Cancel"
And the browser's own confirm box is not used

### AC2: The go-ahead button removes the role
Given the dialog from AC1 is open
When they choose "Remove role"
Then the dialog closes and Captain Blackbeard is no longer listed

### AC3: Cancel keeps everything as it was
Given the dialog from AC1 is open
When they choose "Cancel"
Then the dialog closes and Captain Blackbeard is still listed, with its cast

### AC4: Escape and a tap outside cancel too
Given a confirmation dialog is open
When they press Escape, or tap outside the dialog
Then it closes as if they had chosen "Cancel"

### AC5: Focus starts on Cancel
Given a confirmation dialog opens
Then keyboard focus is on "Cancel"

### AC6: Focus goes back to the control that asked
Given the dialog from AC1 was opened from Captain Blackbeard's Remove button
When they choose "Cancel"
Then keyboard focus is back on that Remove button

### AC7: The dialog is announced with its question
Given a confirmation dialog is open
Then it is modal, so nothing behind it can be reached
And a screen reader announces it as a dialog named by its question

### AC8: Stepping to another item with unsaved notes asks
Given someone has typed in the Casting notes for Pirate Sketch without saving
When they choose Next
Then the dialog asks "Discard your unsaved notes?" with "Discard changes" and "Cancel"
And "Cancel" keeps them on Pirate Sketch with their typing intact
And "Discard changes" takes them to the next item

### AC9: Leaving the page with unsaved notes asks
Given someone has typed in an item's notes without saving
When they choose another page from the menu
Then the dialog asks "Discard your unsaved notes?"
And "Cancel" keeps them on the item page with their typing intact
And "Discard changes" takes them to the page they chose

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5
- Depends on: none
- One shared dialog, built on the native dialog Help already uses, which any page or component can ask and wait for a yes or no. It is mounted once.
- AC4, AC5 and AC7 belong to the shared dialog and are tested once, in its own test file. The Casting item page and the notes each keep a check that they're wired to it.
- A shared test helper (a `.fixture.ts`) answers the dialog, so later stories' tests don't each write their own. The Casting item page's and notes' tests that stubbed the browser's confirm box move to it.
- Notes are part of every item page frame, so AC8 and AC9 hold on all six item pages; test them once, in the notes' tests.
- Closing the tab with unsaved notes still uses the browser's own "Leave site?" prompt (PRD non-goal).
- Out of scope: every other confirmation (E1.S2–E1.S4).
