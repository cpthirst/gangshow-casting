---
id: in-app-help.E1.S1
title: Land on a Welcome page that explains the Running order
epic: E1
status: done
---

## Story

As a production team volunteer opening the app, I want a short Welcome page that explains what each button does and who can use it, so that I can find my way around without asking someone.

## Acceptance criteria

### AC1: Welcome is first in the menu
Given "sam" is signed in as a Casting Team Member
When sam opens the menu
Then its first entry is "Welcome", followed by "Running order"

### AC2: Signing in lands on Welcome
Given "sam" is not signed in
When sam signs in
Then sam sees the Welcome page, and the browser tab names it "Welcome"

### AC3: The app's own address opens Welcome
Given "sam" is signed in
When sam opens the app's address with no page after it
Then the Welcome page is shown and "Welcome" is marked as the current menu entry

### AC4: The Running order still works from its own address
Given "sam" is signed in
When sam chooses "Running order" from the menu, or opens its address directly
Then the Running order is shown as today, and "Running order" is marked as the current menu entry

### AC5: Links to the Running order still go there
Given there's no saved running order yet
When sam follows the Items page's "Running order page" link
Then sam sees the Running order, not the Welcome page

### AC6: A short introduction
Given "sam" is signed in
When sam opens the Welcome page
Then sam sees a heading "Welcome" and an introduction of one or two lines saying what the app is for

### AC7: The Running order's section
Given "sam" is signed in
When sam opens the Welcome page
Then there is a "Running order" section with a link to the Running order page
And it has one short line for each of: reading the order, dragging an item, moving it up, down or to the other half, editing it, removing it, adding an item, Save as Draft, and Reset

### AC8: Lines show the real icon
Given "sam" is on the Welcome page
When sam reads the line about moving an item up
Then it shows the same move-up icon the Running order uses, next to words that say what it does

### AC9: Every line says who can use it
Given "sam" is on the Welcome page
When sam reads the Running order section
Then each line carries exactly one of "Everyone", "Casting team and admins" or "Admins only", written as words
And Remove, Add item and Save as Draft say "Admins only"
And the dragging, moving, editing and Reset lines say "Casting team and admins"
And reading the order says "Everyone", so a read-only reviewer sees what they can do there

### AC10: It's short
Given the Running order section
When it's shown
Then it has no more than 8 lines about actions

### AC11: Every role sees the same help
Given "jo" is a Read-Only Team Member and "alex" is an Admin
When each opens the Welcome page
Then each sees the same introduction, lines and labels as sam

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5, FR11
- Depends on: none
- Moving the Running order off the app's address means updating links that point at it, such as the Items page's empty state (AC5) and any tests that start at the app's address.
- Write each page's help once, in a form that E1.S2's help button can show too (FR9).
- The icons need text alternatives or words next to them; the access label is a word, not just a colour (NFR Accessibility).
- The help is fixed text with no cast data (NFR Security).
- The e2e walks don't cover a Welcome page yet. Offer to add it to the 320px/360px walk; don't add it unasked (ADR 0011).
- Review: at the user's choice, a line about reading the order ("Everyone") was added, so read-only reviewers see what they can do, and the three move buttons share one line to stay within 8.
- Out of scope: the help button and dialog (E1.S2); other pages' help (E2).
