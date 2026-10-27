---
feature: production-props
status: approved
prd: ./prd.md
---

# Production props: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Department permissions, enforced by the API and reflected on every page | FR1, FR2, FR3, FR4, FR5 |
| E2 | Admins give and change permissions, and they can be tried locally | FR6, FR7, FR8, FR9 |
| E3 | Stage, Tech and Costume pages under Production, each with a view switch | FR10, FR11, FR12 |
| E4 | Each item's props list, kept by Stage | FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21 |
| E5 | The props list in Word, for everyone | FR22, FR23 |
| E6 | How many of each prop, and who carries them | FR24, FR25, FR26, FR27, FR28, FR29 |

## E1: Permissions in the API and on the pages

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E1.S1](stories/E1-S1-permissions-enforced-by-the-api.md) | Walking skeleton: accounts are Admin or have any of Casting, Stage, Tech and Costume. Each change route names the permission it needs (every route today needs Casting). Existing accounts keep their access on deploy, and an unknown permission fails safe to read-only. Includes the ADR amending ADR 0020 | FR1, FR2, FR4, FR5 | (none) | done |
| [production-props.E1.S2](stories/E1-S2-controls-follow-permissions.md) | Pages show change controls only to accounts with that department's permission, so an account with only Stage sees the casting pages and Running order read-only, with the "You can view the casting, but not change it." line | FR3 | E1.S1 | done |

## E2: Managing permissions

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E2.S1](stories/E2-S1-change-an-accounts-permissions.md) | The Accounts page shows each account's permissions. An admin changes them with tick boxes, or makes the account an Admin, after confirming what the person will be able to change. Never their own access, and never the last admin | FR6, FR7, FR8 | E1.S1 | done |
| [production-props.E2.S2](stories/E2-S2-permissions-for-a-new-account.md) | An admin ticks the permissions when creating an account. A new account starts with none | FR6 | E2.S1 | done |
| [production-props.E2.S3](stories/E2-S3-permission-switch-in-dev-and-demo.md) | The "Local role" switch in dev and the demo offers Admin, or any combination of the four permissions | FR9 | E1.S1 | done |

## E3: Department pages

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E3.S1](stories/E3-S1-stage-tech-and-costume-pages.md) | The Production menu keeps its place, with three pages and no further menu level: Stage (a Scenery / Props view switch, like the Casting Overview's, opening on Scenery), Tech (Mic plot / SFX) and Costume (a placeholder). Old Production addresses open the right page and view, Welcome and Help describe the pages, and the old Mic plot, Props, Scenery and SFX usage is purged | FR10, FR11, FR12 | E1.S1 | done |

## E4: Props

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E4.S1](stories/E4-S1-props-list.md) | The Stage page's Props view lists the running order by half. Columns: Props (a pencil button, or view without Stage), #, the title with "Not in printed programme", and the number of props. Without a saved running order, it points to the Running order page | FR13, FR15 | E1.S2, E3.S1 | done |
| [production-props.E4.S2](stories/E4-S2-add-a-prop.md) | Each item's props page shows the item's name and position, with All items, Previous and Next, says when there are no props, and handles an unknown item. Stage or Admin can add a prop by name. Props are listed alphabetically, numbers by value | FR16, FR17, FR21 | E4.S1 | done |
| [production-props.E4.S3](stories/E4-S3-roles-on-a-prop.md) | Adding a prop takes none, one or many of the item's roles, picked as for an ensemble. Each card shows its roles, each with its current cast or "uncast". A removed role leaves its props in place without it | FR17, FR18, FR21 | E4.S2 | done |
| [production-props.E4.S4](stories/E4-S4-edit-and-remove-a-prop.md) | The pencil on a prop card edits its name and roles, and the trash can removes the prop after confirming. Neither shows without Stage | FR19 | E4.S3 | done |
| [production-props.E4.S5](stories/E4-S5-props-notes.md) | Each item's props page has Props notes, kept apart from the casting notes. Saving is refused if someone else has saved since the page loaded. The notes also show in full under the item on the Props page | FR14, FR20 | E4.S2 | done |

## E5: Export to Word

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E5.S1](stories/E5-S1-export-props-list.md) | The Props page's Generate Props List button downloads a Word props list for every role. Every item appears in running order by half, including unprinted items and items with no props ("No props"), with its props notes and a prop, character and cast table | FR22, FR23 | E4.S3, E4.S5 | done |

## E6: Quantities and carriers

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-props.E6.S1](stories/E6-S1-prop-quantity.md) | Adding and editing a prop takes a quantity from 1 to 99, starting at 1. Existing props have 1. A card shows "×10" after the name when it's above 1, and every props count, the Overview's included, adds up quantities | FR24, FR25 | E4.S4 | done |
| [production-props.E6.S2](stories/E6-S2-choose-who-carries-a-prop.md) | When a prop's roles have more cast than its quantity, adding or editing it offers a carrier picker of that cast, up to the quantity, saying how many are left. The card shows only the carriers, and "N left to choose". When the cast fits the quantity, everyone carries it, as today. The API refuses a carrier outside the prop's roles, or too many | FR26, FR27 | E6.S1 | done |
| [production-props.E6.S3](stories/E6-S3-carriers-follow-casting.md) | A carrier who leaves the prop's roles (recast, removed from the cast, or the role removed) drops off the card, which then says one more is to choose. The quantity can't be lowered below the number of carriers | FR28 | E6.S2 | done |
| [production-props.E6.S4](stories/E6-S4-export-quantities-and-carriers.md) | The Word props list shows each prop's quantity and its carriers in the cast column, saying how many are still to choose | FR29 | E6.S2 | ready |

## Order

E1.S1 → E1.S2 → E2.S1 → E2.S2 → E2.S3 → E3.S1 → E4.S1 → E4.S2 → E4.S3 → E4.S4 → E4.S5 → E5.S1 → E6.S1 → E6.S2 → E6.S3 → E6.S4

The order of the first stories matters for safety:
- E1.S1 deploys the permissions with every existing route still needing Casting, so nobody's access changes.
- E1.S2 makes the pages follow permissions before admins can hand out Stage alone (E2).

E2.S3 can move earlier if a permission switch would help when trying out E1.S2 by hand. Props (E4) waits for the Stage page (E3.S1), so the page is built in its final place.

E6 was added on 2026-10-27, after "Bread basket" linked to Villagers read as if every villager carried one. E6.S1 ships alone first: a quantity is useful on its own, and carriers need it to say how many to choose. E6.S3 and E6.S4 can go in either order after E6.S2.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S2 |
| FR4 | E1.S1 |
| FR5 | E1.S1 |
| FR6 | E2.S1, E2.S2 |
| FR7 | E2.S1 |
| FR8 | E2.S1 |
| FR9 | E2.S3 |
| FR10 | E3.S1 |
| FR11 | E3.S1 |
| FR12 | E3.S1 |
| FR13 | E4.S1 |
| FR14 | E4.S5 |
| FR15 | E4.S1 |
| FR16 | E4.S2 |
| FR17 | E4.S2, E4.S3 |
| FR18 | E4.S3 |
| FR19 | E4.S4 |
| FR20 | E4.S5 |
| FR21 | E4.S2, E4.S3 |
| FR22 | E5.S1 |
| FR23 | E5.S1 |
| FR24 | E6.S1 |
| FR25 | E6.S1 |
| FR26 | E6.S2 |
| FR27 | E6.S2 |
| FR28 | E6.S3 |
| FR29 | E6.S4 |
