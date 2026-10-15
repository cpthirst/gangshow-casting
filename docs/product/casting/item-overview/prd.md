---
feature: casting-item-overview
status: approved
owner: cpthirst
date: 2026-10-15
---

# Casting item overview: PRD

## Problem

Each item has its own set of parts: a few leads, some supporting and cameo parts, and an ensemble. The team needs one page per item that shows those parts in a predictable order, with the most important first, and who is playing each. Today that information is scattered across the running order's free-text "cast" and "leads" notes and people's memories of the meeting.

## Users

| User | Need |
|---|---|
| Item leaders | See every part in their item, and who has it, at a glance |
| Production team in a casting meeting | Know straight away which parts in an item are still uncast |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| An item's casting is readable at a glance | Clicks to see every role in an item, its size and who has it | 0 (once on the item's page) |
| Roles always appear in the same order | Items whose roles aren't ordered by size, then role name | 0 |
| Uncast parts stand out | Uncast roles not visibly marked as uncast | 0 |

## Non-goals

- Adding, editing and removing roles. These are in casting-roles, though their controls sit on this page.
- Rule warnings for the item (casting rules PRD).
- Item details from the running order beyond its name and position: stage, timing, comments and leads.
- Moving between items with next and previous buttons.

## Functional requirements

- **FR1**: Each item's page must show the item's **name** and its **position in the running order**: its number (if it's in the printed programme) and its half, for example "Item 7 · First half".
- **FR2**: If the item has no roles, the page must show only the name, the position and an empty state that says no roles have been added yet.
- **FR3**: Once an item has roles, each role must appear as a card with its role name, a small **pill** showing its role size, and the cast member or members in it, or a clear "uncast" marker.
- **FR4**: Roles must be ordered by role size (lead, support, cameo, ensemble) and then alphabetically by role name, ignoring case.
- **FR5**: Each item's page must have its own URL, so it loads directly and survives a refresh. The browser tab names the item.
- **FR6**: An item that isn't in the latest saved running order must show a "not found" message with a link back to the Items list.
- **FR7**: The page must offer a way back to the Items list.

## Non-functional requirements

- **Security and safeguarding**: this page shows young people's names next to parts. The data stays local and git-ignored, and the API listens on loopback only. Before casting data is served from anywhere shared, access must be limited to the production team, with its own story and ADR (CLAUDE.md). No names in server logs. Tests use made-up names.
- **Accessibility**: WCAG 2.2 AA. The role-size pill has text, not only colour, and the four sizes are distinguishable without colour. Roles are a list, so screen readers announce how many there are. The page is usable at 360px width.
- **Performance**: an item with up to about 40 roles loads in under 1 second locally.

## Constraints and assumptions

- **Item data**: name and position come from the latest saved running order, worked out the same way as on the Running order page.
- **Cast member names** come from the production's cast list (cast-management), shown as first name and last name.
- **Ensemble cards** can list many cast members. The order of those names (assumed: by last name) is decided when the card is designed.
- **Assumption**: "Name" means the item's title as shown in the running order.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Large ensembles make cards very long on a phone | M | L | Show the count, and let long name lists wrap or collapse. Decide in the story |
| Pill colours clash with the Gang Show brand or fail contrast | L | L | Text labels on every pill, and contrast checks at review |

## Open questions

- In what order are an ensemble's cast members listed? Assumed: by last name, then first name, and written into casting-roles.E2.S2 on that basis. Owner: production team.
- Should the page also show the running order's free-text "cast" and "leads" notes while casting moves into roles? Owner: production team.
