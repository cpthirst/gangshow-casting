---
feature: cast-management
status: approved
prd: ./prd.md
---

# Cast management: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See and find cast members | FR1, FR2, FR8 |
| E2 | Keep the cast list current | FR3, FR4, FR5, FR6, FR7 |
| E3 | Note how each person sings and acts | FR9 |

## E1: See and find cast members

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [cast-management.E1.S1](stories/E1-S1-view-cast-list.md) | View the cast list (walking skeleton: shared schema → local store → API → Cast page; starting list converted locally) | FR1, FR8 | (none) | done |
| [cast-management.E1.S2](stories/E1-S2-filter-cast-list.md) | Filter the cast list by first name, last name and section | FR2 | E1.S1 | done |

## E2: Keep the cast list current

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [cast-management.E2.S1](stories/E2-S1-add-cast-member.md) | Add a cast member (app-assigned ID, validation) | FR3, FR6, FR7 | E1.S1 | done |
| [cast-management.E2.S2](stories/E2-S2-edit-cast-member.md) | Edit a cast member's details (all but the ID; refuses stale edits) | FR4, FR6, FR7 | E2.S1 | done |
| [cast-management.E2.S3](stories/E2-S3-delete-cast-member.md) | Delete a cast member after confirming | FR5, FR7 | E1.S1 | done |

## E3: Note how each person sings and acts

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [cast-management.E3.S1](stories/E3-S1-singing-and-acting-notes.md) | Add and edit short Singing and Acting notes on cast members; shown as columns (labelled lines on phones), not filterable | FR9 | E2.S2 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S2 |
| FR3 | E2.S1 |
| FR4 | E2.S2 |
| FR5 | E2.S3 |
| FR6 | E2.S1, E2.S2 |
| FR7 | E2.S1, E2.S2, E2.S3 |
| FR8 | E1.S1 |
| FR9 | E3.S1 |

## Notes

- **Persistence: raw JSON, like the running order, until a database is chosen** (DynamoDB is expected, with its own ADR when hosting is decided).
  - **File:** one local, git-ignored file per production, `apps/api/data/<productionId>/cast.json`, behind a storage interface, with an in-memory version for tests. Swapping in a database changes only that implementation.
  - **IDs:** numeric. The starting list uses 1–56, and new members get the next unused number.
  - **No history.** Unlike the running order's immutable versions, this file is rewritten in place on each change. Delete must really remove a person's data (PRD FR5, ADR 0010), and old snapshots would keep it.
  - **Revisions:** each member carries a `revision` that goes up on every edit, so a stale edit or delete is refused (FR7).
  - **Writes:** atomic (temp file, then rename). The dev server is one process, so saves are serialised.
- **E1.S1 builds the store.**
- **E2.S2 depends on E2.S1** so it can reuse the add form. E2.S3 only needs the list, so it can be built in parallel with E2.S1.
- **Out of scope** (PRD non-goals): mass upload, casting into items, and a duplicate-name warning (an open question for the team).
