---
feature: team-roles
status: approved
prd: ./prd.md
---

# Team roles: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Three roles, with read-only enforced by the API | FR1, FR2, FR3, FR7 |
| E2 | Read-only pages: everything visible, nothing editable | FR5, FR6 |
| E3 | Admins give and change roles | FR4, FR8, FR9, FR10, FR11, FR14 |
| E4 | Access changes bite within 5 minutes | FR12, FR13 |
| E5 | Maintainer and local tooling | FR15, FR16 |

## E1: Roles in the API

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [team-roles.E1.S1](stories/E1-S1-read-only-enforced-by-the-api.md) | Walking skeleton: the three roles exist, existing team members become Casting Team Members on deploy, an unknown role fails safe to read-only, and the API refuses every change from a read-only member | FR1, FR2, FR3, FR7 | (none) | done |

## E2: Read-only pages

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [team-roles.E2.S1](stories/E2-S1-read-only-running-order.md) | Read-only members see the Running order with no moves, drags, edits, adds, removes, Save or Reset, and a "read-only access" line | FR5, FR6 | E1.S1 | done |
| [team-roles.E2.S2](stories/E2-S2-read-only-cast-list.md) | Read-only members see the Cast list, with its casting notes and filters, but no add, edit or delete | FR5, FR6 | E1.S1 | done |
| [team-roles.E2.S3](stories/E2-S3-read-only-items-and-overview.md) | Read-only members see the Items list, each item's roles and notes, and the Overview, with no role or notes editing | FR5, FR6 | E1.S1 | done |

## E3: Managing roles

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [team-roles.E3.S1](stories/E3-S1-change-an-accounts-role.md) | The Accounts page shows each account's role by its new name; an admin changes it with one role choice, confirming first, never their own and never the last admin | FR4, FR10, FR11, FR14 | E1.S1 | done |
| [team-roles.E3.S2](stories/E3-S2-choose-a-role-for-a-new-account.md) | An admin chooses the role when creating an account, defaulting to Read-Only Team Member, who can then sign in like anyone else | FR8, FR9 | E3.S1 | done |

## E4: Access changes bite quickly

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [team-roles.E4.S1](stories/E4-S1-access-changes-within-5-minutes.md) | A role change, disable or password reset reaches every device within 5 minutes; a page explains a change refused as read-only | FR12, FR13 | E3.S1 | done |

## E5: Maintainer and local tooling

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [team-roles.E5.S1](stories/E5-S1-post-deploy-check-for-read-only.md) | The post-deploy check confirms a read-only account is refused every change, with its account set up from the repository | FR15 | E1.S1 | ready |
| [team-roles.E5.S2](stories/E5-S2-role-switch-in-dev-and-demo.md) | Local development and the demo offer a switch between the three roles (starting as admin), never shown in the hosted app | FR16 | E1.S1 | ready |

## Order

E1.S1 → E2.S1 → E2.S2 → E2.S3 → E3.S1 → E3.S2 → E4.S1 → E5.S1 → E5.S2

The read-only pages (E2) come before admins can create read-only accounts (E3). That way no reviewer ever sees an editing control that the API would refuse. E5.S2 can move earlier, if a role switch would help when trying out E2 by hand.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E3.S1 |
| FR5 | E2.S1, E2.S2, E2.S3 |
| FR6 | E2.S1, E2.S2, E2.S3 |
| FR7 | E1.S1 |
| FR8 | E3.S2 |
| FR9 | E3.S2 |
| FR10 | E3.S1 |
| FR11 | E3.S1 |
| FR12 | E4.S1 |
| FR13 | E4.S1 |
| FR14 | E3.S1 |
| FR15 | E5.S1 |
| FR16 | E5.S2 |
