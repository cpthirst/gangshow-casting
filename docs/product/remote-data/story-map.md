---
feature: remote-data
status: approved
prd: ./prd.md
---

# Remote data: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A safe, cheap remote database, defined in code | FR1, FR2, FR3, FR4, FR5, FR6, FR11, FR13 |
| E2 | Everything the app saves works against the remote database | FR5, FR6, FR7 |
| E3 | Move the production's data across, prove it, then remove the local files | FR8, FR9, FR10 |
| E4 | A maintainer's guide from new AWS account to files removed | FR12 |

## E1: A safe, cheap remote database, defined in code

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [remote-data.E1.S1](stories/E1-S1-item-notes-on-the-remote-database.md) | Item notes on the remote database (walking skeleton: retained table with 7-day recovery in CDK → notes store → API chosen by config → emulator tests in CI; deployed by the maintainer) | FR1, FR2, FR3, FR4, FR5, FR6, FR11 | (none) | done |
| [remote-data.E1.S2](stories/E1-S2-budget-alert.md) | A monthly budget alert, emailed to the maintainer | FR13 | E1.S1 | done |

## E2: Everything the app saves works against the remote database

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [remote-data.E2.S1](stories/E2-S1-cast-on-the-remote-database.md) | Cast members on the remote database (list, add with never-reused ids, edit, refuse stale saves) | FR5, FR6 | E1.S1 | done |
| [remote-data.E2.S2](stories/E2-S2-roles-on-the-remote-database.md) | Roles on the remote database (unique names per item, never-reused ids, refuse stale saves) | FR5, FR6 | E1.S1 | ready |
| [remote-data.E2.S3](stories/E2-S3-delete-and-uncast-together.md) | Deleting a cast member uncasts them from every role in one all-or-nothing change, on files and remote | FR7 | E2.S1, E2.S2 | ready |
| [remote-data.E2.S4](stories/E2-S4-running-order-on-the-remote-database.md) | Running-order versions on the remote database (latest, every version kept, refuse saves from an old version) | FR5, FR6 | E1.S1 | ready |

## E3: Move the production's data across, prove it, then remove the local files

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [remote-data.E3.S1](stories/E3-S1-copy-a-production.md) | Copy a production's data from the files to the remote database, safe to re-run | FR8 | E2.S3, E2.S4 | ready |
| [remote-data.E3.S2](stories/E3-S2-verify-the-copy.md) | Verify the copy by reading everything through the API from both, reporting differences by id only | FR9 | E3.S1 | ready |
| [remote-data.E3.S3](stories/E3-S3-remove-the-local-files.md) | Remove the local files, only after a passing verification since the last copy, and after confirming | FR10 | E3.S2 | ready |

## E4: A maintainer's guide from new AWS account to files removed

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [remote-data.E4.S1](stories/E4-S1-maintainers-guide.md) | Step-by-step guide: account, MFA and profile, deploy, switch, copy, verify, remove | FR12 | E3.S3, E1.S2 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S1, E2.S1, E2.S2, E2.S4 |
| FR6 | E1.S1, E2.S1, E2.S2, E2.S4 |
| FR7 | E2.S3 |
| FR8 | E3.S1 |
| FR9 | E3.S2 |
| FR10 | E3.S3 |
| FR11 | E1.S1 (every E2 story adds its store's tests) |
| FR12 | E4.S1 |
| FR13 | E1.S2 |
