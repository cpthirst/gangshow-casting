---
feature: casting-items
status: approved
owner: cpthirst
date: 2026-10-15
---

# Casting items: PRD

## Problem

At a casting meeting, the team works through the show item by item. Today they have to put the running order (a Word document) next to the cast spreadsheet to see which items still need parts filled, and nothing tells them how far casting has got. They need one list of the show's items, in running order, that shows each item's casting progress at a glance and leads into that item's casting.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting (directors, item leaders) | See which items still need casting, in show order, and open one quickly |
| Volunteers updating after a rehearsal | Find the item they're working on without scrolling through management controls |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Casting progress is visible at a glance | Clicks to see how many roles an item has and how many are cast | 0 (shown on the list) |
| The list always matches the running order | Items in the latest saved running order that are missing, extra or out of order on the list | 0 |
| Any item's casting is one step away | Clicks from the Items list to an item's page | 1 |

## Non-goals

- Changing the running order: reordering, editing, adding or removing items. That stays on the Running order page.
- Rules and their warning and error icons (back-to-back appearances, uneven stage time). These come in the later casting rules PRD.
- Deleting an item's roles when the item is removed from the running order. The running order can't remove items yet (running-order FR10, deferred), so this is left until it can (see Open questions).
- Unsaved running-order changes. The list shows the latest saved version only.
- The running clock (start times, half totals, interval).

## Functional requirements

- **FR1**: The Items page must list every item in the production's latest saved running order, in the same two halves and the same order. It shows each item's number (blank for items not in the printed programme, as on the Running order page) and title.
- **FR2**: Each item must show its **total number of roles** and its **roles cast** (roles with at least one cast member), for example "Roles 5 · Cast 3". An item with no roles shows that it has none.
- **FR3**: Choosing an item must open that item's page (casting-item-overview).
- **FR4**: The list must show no controls for managing the running order: no drag handles and no move buttons.
- **FR5**: When the running order is saved as a new version, the Items page must reflect the new order and titles the next time it's opened or refreshed.
- **FR6**: If there is no saved running order for the production, the page must say so and point the user to the Running order page.
- **FR7**: The page must show which saved running-order version (for example "Draft 7") the list is based on, so nobody mistakes it for unsaved changes.

## Non-functional requirements

- **Security and safeguarding**: the list shows item details and counts only, not cast members' names. The data stays local and git-ignored, and the API listens on loopback only, as for the running order and cast. Tests use made-up items.
- **Accessibility**: WCAG 2.2 AA. Counts have text labels and don't rely on colour. Each item is a single link with an accessible name that includes its number and title. The list is usable at 360px width.
- **Performance**: the list for a show of about 25 items, with their role counts, loads in under 1 second locally.

## Constraints and assumptions

- **Source of items**: the running order's latest saved version (running-order PRD). Items are identified by their stable running-order IDs. Numbers are worked out the same way as on the Running order page, never stored.
- **Role counts**: come from the casting-roles data for the same production.
- **Layout**: looks like the Running order page (halves, numbers, titles) so the two feel familiar, with the counts where the management controls would be.
- **API**: Lambda-shaped handlers (ADR 0006), with shapes in `packages/shared`.
- **Scope**: one production (2027). Casting never carries over between productions (CLAUDE.md).
- **Assumption**: the list leaves room for a later status icon per item (casting rules PRD), without needing a redesign.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Roles are left pointing at items no longer in the running order once removal arrives | M (when running-order FR10 is built) | M | Recorded as an open question. Resolve before running-order item removal is built |
| The team expects to see unsaved running-order changes here | M | L | The page shows the running-order version it's based on |
| Showing two similar lists (Running order and Items) confuses people | L | M | Items shows counts, not controls. Check the names with the team |

## Open questions

- When an item is removed from the running order (running-order FR10, deferred), what happens to its roles and casting? Expected: they're deleted. Owner: production team, before FR10 is picked up.
- Should the running order's free-text "cast" and "leads" fields eventually be replaced by the roles cast here? Owner: production team.
- Should items that aren't in the printed programme (such as TBC items) be listed for casting? Assumed yes, unnumbered. Owner: production team.
