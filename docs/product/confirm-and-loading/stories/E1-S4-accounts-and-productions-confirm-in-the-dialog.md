---
id: confirm-and-loading.E1.S4
title: Accounts and Productions confirm in the dialog, and nothing uses the browser's box
epic: E1
status: ready
---

## Story

As an admin, I want changes to accounts and productions to ask in iCUE's own dialog, so that the riskiest actions in the app ask in the same clear way as the rest.

## Acceptance criteria

### AC1: Resetting a password asks in the dialog
Given an admin on the Accounts page, with an account called props-team
When they choose "Reset password" on props-team
Then the dialog asks the question the page asks today
And its buttons are "Reset password" and "Cancel"
And "Cancel" leaves the password as it was

### AC2: Disabling an account asks in the dialog
Given props-team is enabled
When the admin chooses "Disable account" on it
Then the dialog asks the question the page asks today
And its buttons are "Disable account" and "Cancel"
And "Cancel" leaves it enabled
And enabling an account still doesn't ask

### AC3: Changing an account's access asks in the dialog
Given the admin has changed props-team's ticked permissions
When they choose "Save"
Then the dialog asks the question the page asks today
And its buttons are "Save" and "Cancel"
And "Cancel" leaves the tick boxes open as they were, to change or cancel

### AC4: Starting a production asks in the dialog
Given an admin on the Productions page has entered 2028
When they choose "Save"
Then the dialog asks "Start production 2028? Everyone will move to 2028, and this can't be undone."
And its buttons are "Save" and "Cancel"
And "Cancel" starts nothing

### AC5: Deleting a past production asks in the dialog
Given 2026 is a past production
When the admin chooses "Delete production" on 2026
Then the dialog asks the question the page asks today, naming 2026 and the backup window
And its buttons are "Delete production" and "Cancel"
And "Cancel" keeps 2026

### AC6: Nothing uses the browser's confirm box
Given the web app's source
Then nothing in it calls the browser's own confirm box
And a test fails if anything does

## Notes

- FRs: FR1, FR2
- Depends on: E1.S1, and E1.S2 and E1.S3 for AC6
- Each question stays word for word. Tests that stubbed the browser's confirm box answer the dialog through E1.S1's shared test helper instead.
- AC6 finishes the move (CLAUDE.md, "Simplicity"). Its test checks the source, as the harness tests do.
