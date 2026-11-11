---
feature: confirm-and-loading
status: approved
owner: Nick Hirst
date: 2026-11-11
---

# Confirm and loading: PRD

## Problem

Two things make iCUE look unfinished on a phone, where volunteers use it most.

- **Confirmations are the browser's.** 16 actions ask before going ahead: removing a role, an item, a prop, a file or a cast member, discarding unsaved changes, replacing a file, changes to accounts, and starting or deleting a production. Every one uses the browser's own box. On a phone that shows the site's address over the question, and **Cancel / OK**, so "OK" is the word for removing a role, deleting a production and throwing away notes alike. It looks like a system warning rather than part of iCUE, and it can't be styled, tested in a real browser, or shown in the demo's screenshots.
- **Item pages are blank while they load.** Every item page (Casting, Props, Scenery, SFX, Wardrobe, Mic plot) shows only its back, Previous and Next links until its data arrives. On a church-hall signal, or while the API wakes up, that looks broken, and people tap again or give up.

Both were found with a throwaway mock-up built with the `variant` and `states` approach (ADR 0040), in which the user chose the shared dialog over the browser's box and over Undo.

## Users

| User | Need |
|---|---|
| Production team volunteers, on a phone during or after a rehearsal | To see at a glance what a confirmation will do, and which button does it |
| Department volunteers (Props, Stage, Tech, Wardrobe) | To know an item page is loading, not broken |
| Admins | The same clear confirmations for account and production changes |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Confirmations are iCUE's own | Calls to the browser's confirm box in `apps/web/src` | 0, held by a test |
| The button names the action | Confirmations whose go-ahead button is a verb for the action, not "OK" | All 16 |
| Item pages never look blank while loading | Item pages that show a loading state until their data arrives | All 6 |

## Non-goals

- **Undo.** Removals stay permanent and confirmed first. No soft delete, restore route or change to the API or stored data.
- **Rewording the questions.** Each confirmation keeps the question it asks today, word for word.
- **Closing the tab with unsaved changes.** The browser's own "Leave site?" stays; no page can replace it.
- **Loading states on the list pages.** They already load the shared way (simplify.E4.S2); this covers the item page frame.

## Functional requirements

### Epic 1: One confirmation dialog

- **FR1**: The app has one confirmation dialog, which every action that asks before going ahead uses. Nothing in the web app calls the browser's confirm box, and a test fails if something does.
- **FR2**: The dialog shows the question the action asks today, word for word, with two buttons: Cancel, and one that goes ahead. The go-ahead button uses the same verb as the control that opened the dialog, with the thing it acts on, for example "Remove role" or "Delete production". When leaving a page opened it, the button is "Discard changes".
- **FR3**: Cancel, Escape and a tap outside the dialog all cancel, leaving everything as it was. Only the go-ahead button goes ahead.
- **FR4**: When the dialog opens, keyboard focus is on Cancel. When it closes, focus returns to the control that opened it, or, where that control has gone, where the page puts it today.
- **FR5**: Leaving a page or stepping to another item with unsaved changes (Running order, item notes) asks in the same dialog. Staying keeps the changes.

### Epic 2: Item pages show they're loading

- **FR6**: While an item page's data loads, the shared item page frame shows that it is loading, under its back, Previous and Next links, in place of a blank page. It goes as soon as the item, not-found or error state shows.

## Non-functional requirements

- **Security**: no change. The API still refuses what a person can't do, whatever the dialog shows.
- **Accessibility**: WCAG 2.2 AA. The dialog is modal, with the background inert and focus kept in it, and it is announced with its question. The loading state is announced once, politely, and any animation respects reduced motion.
- **Performance**: no extra requests. The dialog opens at once, and the loading state shows only while data is on its way.
- **UI consistency**: the dialog looks like Help's, and its buttons use the app's existing primary and secondary button styles.

## Constraints and assumptions

- Web app only. No change to `packages/shared`, the API or infra.
- The dialog builds on the native dialog Help already uses (ADR 0008's bundled assets; no new dependency).
- Tests that answered the browser's confirm answer the dialog instead, through one shared test helper.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A route guard that now waits for an answer lets navigation through | M | H | Tests for staying and leaving on both pages with unsaved changes |
| Moving 16 call sites changes behaviour beyond the box | M | M | Each keeps its question and outcome; one story per area, each with its own tests |
| The loading state flashes on fast loads | L | L | It shows only until the frame's first answer; keep it plain |

## Open questions

- None.
