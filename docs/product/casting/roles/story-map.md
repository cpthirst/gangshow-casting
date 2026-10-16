---
feature: casting-roles
status: approved
prd: ./prd.md
---

# Casting roles: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Add roles to an item | FR1, FR2, FR3, FR8, FR10 |
| E2 | Change and remove roles | FR4, FR5, FR6, FR7, FR8 |
| E3 | Keep casting in step with the cast list | FR9 |

## E1: Add roles to an item

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-roles.E1.S1](stories/E1-S1-add-role.md) | Add an uncast role with a name and size, with required and length checks (walking skeleton: shared schema → roles store → API → item page) | FR1, FR3, FR8 | casting-item-overview.E1.S1 | done |
| [casting-roles.E1.S2](stories/E1-S2-unique-role-names.md) | Refuse a role name already used in the same item | FR3 | E1.S1 | done |
| [casting-roles.E1.S3](stories/E1-S3-cast-when-adding.md) | Cast someone when adding a role, picked from a filterable search of the cast | FR1, FR2, FR10 | E1.S1, casting-item-overview.E2.S1 | done |

## E2: Change and remove roles

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-roles.E2.S1](stories/E2-S1-edit-role.md) | Edit a role: rename, resize, cast, recast or uncast; refuses stale edits | FR4, FR8 | E1.S3 | done |
| [casting-roles.E2.S2](stories/E2-S2-ensemble-members.md) | Add and remove ensemble members; refuse narrowing an ensemble that has several people | FR5, FR6 | E2.S1 | ready |
| [casting-roles.E2.S3](stories/E2-S3-remove-role.md) | Remove a role after confirming; refuses stale removals | FR7, FR8 | E1.S1 | done |

## E3: Keep casting in step with the cast list

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-roles.E3.S1](stories/E3-S1-deleted-member-leaves-roles.md) | Deleting a cast member removes them from every role | FR9 | E1.S3 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 (name and size), E1.S3 (cast member) |
| FR2 | E1.S3 |
| FR3 | E1.S1 (required, length), E1.S2 (duplicate name) |
| FR4 | E2.S1 |
| FR5 | E2.S2 |
| FR6 | E2.S2 |
| FR7 | E2.S3 |
| FR8 | E1.S1 (saves straight away), E2.S1 and E2.S3 (stale changes refused) |
| FR9 | E3.S1 |
| FR10 | E1.S3 |

## Notes

- **Persistence follows cast-management:** one local, git-ignored file per production (`apps/api/data/<productionId>/roles.json`), behind a storage interface with an in-memory version for tests. It's rewritten in place, with no history, because roles hold personal data (ADR 0010).
- **Roles are keyed by running-order item ID** and hold cast member IDs, never names.
- **Revisions:** each role carries a `revision`, as cast members do, so stale edits and removals are refused (FR8).
- **E1.S1 shows roles as a plain list** (name and size) so a new role is visible. casting-item-overview.E2.S1 turns it into ordered cards.
- **E3.S1 crosses features:** deleting a cast member (cast-management) must also update the roles file. Both writes must succeed or neither does, so they need careful ordering in a single process.
- **Role counts on the Items list** (casting-items.E2.S1) come after E1.S3.
