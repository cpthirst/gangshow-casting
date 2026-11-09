---
feature: simplify
status: approved
prd: ./prd.md
---

# Simplify: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Each department is described once, and nothing about a cut item is left behind | FR1, FR2, FR3, FR4, FR5 |
| E2 | Every page about one item shares one frame | FR6, FR7, FR8, FR17 |
| E3 | The layout explains itself, without taglines or hint lines | FR9, FR10, FR11, FR12, FR13, FR14, FR15 |
| E4 | Shared pieces have plain names, and data loads one way from one production | FR16, FR17, FR18 |
| E5 | More than one production: start, open, look back, delete | FR19, FR20, FR21, FR22, FR23 |

## E1: One list of departments

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [simplify.E1.S1](stories/E1-S1-cut-item-takes-its-notes-and-props.md) | Saving a running order that cuts an item also deletes its scenery notes, props and props notes. Reset still undoes a cut before saving. The first save also removes leftovers from earlier cuts | FR1 | (none) | done |
| [simplify.E1.S2](stories/E1-S2-refusals-name-their-department.md) | A shared list of departments, each with its permissions and refusal line. A refusal names its route's department, whatever order the permissions are listed in. The route patches go, and every refusal's wording stays exactly the same. The app spots a read-only refusal without matching its wording. Includes the ADR amending ADR 0029 | FR2, FR3, FR4 | (none) | done |
| [simplify.E1.S3](stories/E1-S3-pages-read-the-department-list.md) | The Overview's buttons and notes, the department item pages, the read-only line and the "can change" checks all take each department's name, permissions and wording from the shared list | FR2 | E1.S2 | done |
| [simplify.E1.S4](stories/E1-S4-help-and-usage-read-the-department-list.md) | Help's access details and the Usage page's department labels come from the shared list | FR2 | E1.S2 | done |
| [simplify.E1.S5](stories/E1-S5-every-kind-of-item-data-goes-with-a-cut.md) | Cutting an item removes every kind of data kept per item, taken from one list. A test fails if a new kind is added without it | FR5 | E1.S1 | done |

## E2: One frame for every item page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [simplify.E2.S1](stories/E2-S1-file-pages-share-the-item-frame.md) | One item page frame: back link, Previous and Next, "Department: Item" title, position, notes headed by department, and the not-found and error states. The Scenery, SFX and Wardrobe pages move onto it unchanged | FR6, FR8, FR17 | E4.S1 | done |
| [simplify.E2.S2](stories/E2-S2-mic-plot-shares-the-item-frame.md) | The Mic plot item page moves onto the frame, keeping its channels and export | FR6, FR8, FR17 | E2.S1 | done |
| [simplify.E2.S3](stories/E2-S3-props-shares-the-item-frame.md) | The Props item page moves onto the frame, and its visits are recorded and shown on the Usage page | FR6, FR7, FR8, FR17 | E2.S1 | done |
| [simplify.E2.S4](stories/E2-S4-casting-shares-the-item-frame.md) | The Casting item page moves onto the frame: titled "Casting: Pirate Sketch", with its notes headed "Casting notes" | FR6, FR8, FR17 | E2.S1 | done |

## E3: Let the layout do the explaining

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [simplify.E3.S1](stories/E3-S1-no-taglines.md) | The taglines under Casting Items, the Casting overview and the Production overview go, along with the page descriptions nothing shows. Help summaries stay | FR9 | (none) | done |
| [simplify.E3.S2](stories/E3-S2-view-only-badge.md) | A "View only" badge by the title replaces the read-only sentence on all 8 pages, and each page's Help says who can change it. A refusal still shows as an alert | FR10, FR13 | E1.S4, E2.S4 | done |
| [simplify.E3.S3](stories/E3-S3-notes-count-near-the-limit.md) | A notes box shows how many characters are left only once fewer than 50 remain | FR11 | E2.S1 | done |
| [simplify.E3.S4](stories/E3-S4-hide-controls-that-cannot-work.md) | Controls that can never work for this person are hidden, not disabled with an explanation, e.g. an admin's access and Disable buttons for their own account, Delete on the Cast page for non-admins, and the Running order's changes for non-admins, who see it view only | FR12 | E3.S2 | done |
| [simplify.E3.S5](stories/E3-S5-one-load-failure-alert-and-one-draft-wording.md) | The Production overview shows one alert naming everything that failed to load, and the draft number reads "Draft 3" on every page | FR14, FR15 | (none) | done |

## E4: Name shared pieces for what they are

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [simplify.E4.S1](stories/E4-S1-one-way-to-load-data.md) | One shared way to load data from the API, with one rule for failures and one for "nothing there yet". The file department pages move onto it first | FR17 | (none) | done |
| [simplify.E4.S2](stories/E4-S2-list-pages-load-data-one-way.md) | The list pages (Cast, Running order, Casting, the Overviews, Accounts, Usage) load data the shared way | FR17 | E4.S1 | done |
| [simplify.E4.S3](stories/E4-S3-purpose-named-styles.md) | Cards, button rows, forms, tables and the Open column get names that say what they are. The UX reviewer's brief uses the new names | FR16 | E2.S4 | done |
| [simplify.E4.S4](stories/E4-S4-one-production-id.md) | The web app takes its production from one place. The 7 hard-coded ids go | FR18 | E4.S2 | done |

## E5: More than one production

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [simplify.E5.S1](stories/E5-S1-open-the-newest-production.md) | Walking skeleton: the app keeps a list of productions, holding today's 2027, opens the newest, and shows its year. Includes the ADR for how the list is held | FR20, FR23 | E4.S4 | done |
| [simplify.E5.S2](stories/E5-S2-start-a-production.md) | An admin starts a new production by year, on a new admin-only Productions page. It must be a year not already taken, it starts empty, and it becomes the one everyone opens. Accounts and permissions are unchanged | FR19, FR23 | E5.S1 | draft |
| [simplify.E5.S3](stories/E5-S3-look-back-at-a-past-production.md) | Anyone can switch to an older production. It's view only for everyone: the API refuses every change, the pages show "View only", and exports still work | FR20, FR21 | E5.S2, E3.S2 | draft |
| [simplify.E5.S4](stories/E5-S4-delete-a-past-production.md) | An admin deletes a past production for good, after a confirmation naming its year and the backup window. Its data and files go; its usage records stay until they expire. The newest can't be deleted. Includes the ADR for deleting a production | FR22, FR23 | E5.S3 | draft |

## Order

E1.S1 → E1.S2 → E1.S3 → E1.S4 → E1.S5 → E4.S1 → E2.S1 → E2.S2 → E2.S3 → E2.S4 → E4.S2 → E3.S1 → E3.S2 → E3.S3 → E3.S4 → E3.S5 → E4.S3 → E4.S4 → E5.S1 → E5.S2 → E5.S3 → E5.S4

- E1.S1 goes first: it fixes a live gap in deleting data, and is small.
- E1.S2 starts with the ADR amending ADR 0029, accepted before any code.
- E4.S1 comes before Epic 2, so each item page moves onto the frame and onto the shared way of loading data in one go, and is only reworked once (PRD constraints).
- Epic 3 follows Epic 2, so the "View only" badge goes into the shared frame once rather than into four item pages.
- E4.S3's renames wait for Epic 2, which merges most of the pages that borrow the old names.
- Epic 5 goes last, as the PRD asks. E4.S4 gives it one place for the production, and E3.S2's badge is what a past production shows.
- E3.S1 and E3.S5 depend on nothing, so they can fill gaps between larger stories.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S2, E1.S3, E1.S4 |
| FR3 | E1.S2 |
| FR4 | E1.S2 |
| FR5 | E1.S5 |
| FR6 | E2.S1, E2.S2, E2.S3, E2.S4 |
| FR7 | E2.S3 |
| FR8 | E2.S1, E2.S2, E2.S3, E2.S4 |
| FR9 | E3.S1 |
| FR10 | E3.S2 |
| FR11 | E3.S3 |
| FR12 | E3.S4 |
| FR13 | E3.S2 |
| FR14 | E3.S5 |
| FR15 | E3.S5 |
| FR16 | E4.S3 |
| FR17 | E4.S1, E4.S2, E2.S1, E2.S2, E2.S3, E2.S4 |
| FR18 | E4.S4 |
| FR19 | E5.S2 |
| FR20 | E5.S1, E5.S3 |
| FR21 | E5.S3 |
| FR22 | E5.S4 |
| FR23 | E5.S1, E5.S2, E5.S4 |
