---
feature: confirm-and-loading
status: approved
---

# Confirm and loading: story map

PRD: [prd.md](prd.md)

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | One confirmation dialog | FR1–FR5 |
| E2 | Item pages show they're loading | FR6 |

## E1: One confirmation dialog

| Story | Summary | FRs | Depends on | Status |
|---|---|---|---|---|
| [confirm-and-loading.E1.S1](stories/E1-S1-confirm-dialog-on-item-pages.md) | Walking skeleton: the shared confirmation dialog and its test helper. Removing a role on a Casting item page, and leaving any item page or stepping to another item with unsaved notes, ask in it | FR1, FR2, FR3, FR4, FR5 | (none) | done |
| [confirm-and-loading.E1.S2](stories/E1-S2-running-order-and-cast-confirm-in-the-dialog.md) | The Running order (removing an item, saving gang changes, leaving with unsaved changes) and the Cast page (deleting a member, a section change) ask in the dialog | FR1, FR2, FR5 | E1.S1 | done |
| [confirm-and-loading.E1.S3](stories/E1-S3-files-and-props-confirm-in-the-dialog.md) | Replacing or removing an item file and removing a prop ask in the dialog | FR1, FR2 | E1.S1 | done |
| [confirm-and-loading.E1.S4](stories/E1-S4-accounts-and-productions-confirm-in-the-dialog.md) | The Accounts page (resetting, disabling, changing access) and the Productions page (starting, deleting) ask in the dialog. A test fails if anything calls the browser's confirm box | FR1, FR2 | E1.S1 | ready |

## E2: Item pages show they're loading

| Story | Summary | FRs | Depends on | Status |
|---|---|---|---|---|
| [confirm-and-loading.E2.S1](stories/E2-S1-item-pages-show-they-are-loading.md) | The item page frame shows it's loading until the item, not-found or error state shows, on all six item pages at once | FR6 | (none) | done |

## Order

1. E1.S1, the walking skeleton
2. E2.S1, independent and small
3. E1.S2
4. E1.S3
5. E1.S4, last because its test needs every caller moved

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1, E1.S2, E1.S3, E1.S4 |
| FR2 | E1.S1, E1.S2, E1.S3, E1.S4 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S1, E1.S2 |
| FR6 | E2.S1 |
