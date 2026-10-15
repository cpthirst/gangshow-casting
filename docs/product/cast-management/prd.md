---
feature: cast-management
status: approved
owner: cpthirst
date: 2026-10-15
---

# Cast management: PRD

## Problem

The production team keeps the cast list in a spreadsheet, which currently holds 56 Scouts and Explorers for 2027. Casting people into items, the app's core purpose, needs that list in the app. Today, keeping the list current means passing a file around, with no single place to add a new member, fix a name or remove someone who has left. People also go missing: 7 have no section recorded and 8 have no group.

## Users

| User | Need |
|---|---|
| Production team (directors, item leaders, wardrobe, stage management) | Find a cast member quickly, and keep the list accurate as people join, leave or are corrected |
| Later features (casting into items, clash checks) | One reliable list of cast members with stable IDs |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Finding someone is quick | Actions to find a cast member by name or section | Typing in one filter, or one section choice |
| Keeping the list current is quick | Time to add or correct a cast member | Under 30 seconds |
| The list is complete | 2027 cast members available in the app | All 56 from the starting list |
| Only what's needed is stored | Fields held per cast member | ID, first name, last name, section, group, and nothing else |

## Non-goals

- Mass upload or import of cast lists in the app. The starting list of 56 is converted once, by hand.
- Casting members into items, and clash or stage-time views. Those are later features that use this list.
- Contact details, date of birth, exact age, photos, medical or other personal data (CLAUDE.md safeguarding).
- Age band. It's allowed by the rules but not needed yet.
- Sign-in, and hosting outside a developer's machine (see Constraints).
- Keeping a record of people who have left. Deleting is permanent.
- More than one production on screen. The cast list is for 2027.

## Functional requirements

- **FR1**: The app must list the production's cast members, showing first name, last name, section and group, sorted by last name and then first name. It shows how many are listed.
- **FR2**: Users must be able to filter the list by first name, last name and section, separately or together.
  - Name filters match any part of the name, ignoring case and accents.
  - The section filter offers All, Scouts, Explorers, Network and Not set.
  - The list shows how many match out of the total (for example "12 of 56"). Filters can be cleared in one action.
- **FR3**: Users must be able to add a cast member with first name and last name (required), plus section and group (optional). The app assigns an ID that never changes.
- **FR4**: Users must be able to edit every field of a cast member except the ID.
- **FR5**: Users must be able to delete a cast member, after confirming. Deletion is permanent.
- **FR6**: Invalid details must be explained next to the field, and nothing saved: a missing first or last name, or a name or group over the length limit.
- **FR7**: Adding, editing and deleting must each save straight away. If someone else changed or deleted that cast member since the list was loaded, the change isn't applied. The user is told, and shown the current list.
- **FR8**: The 2027 starting list (`cast.csv`) must be available as the initial cast. It's held locally and never committed to the repository.

## Non-functional requirements

- **Security and safeguarding**:
  - Most of the cast are under 18, and this list holds their full names and Scout groups (ADR 0010).
  - The data stays on the developer's machine, git-ignored, and the API listens on loopback only.
  - Before this data is served from anywhere shared, access must be limited to the production team. That needs its own story and ADR (CLAUDE.md: casting data must never be publicly reachable).
  - Input is validated by the shared schema. No names appear in server logs. Tests use made-up names only.
- **Accessibility**:
  - WCAG 2.2 AA. Filters have visible labels, and the number of matches is announced to screen readers when filters change.
  - Forms explain errors next to the field. Everything works by keyboard and at 360px width.
- **Performance**: a list of up to about 200 cast members loads in under 1 second locally, and filtering updates as you type.

## Constraints and assumptions

- **Fields** (ADR 0010):
  - ID: assigned by the app, unique within the production, never reused or edited.
  - First name and last name: required, up to 40 characters each.
  - Section: Scouts, Explorers, Network, or not set.
  - Group: the member's Scout group or Explorer unit, free text up to 60 characters, optional.
- **Scope**: the cast list belongs to one production (2027). Each production's cast is separate, even when people return (CLAUDE.md).
- **API**: Lambda-shaped handlers (ADR 0006), with shapes in `packages/shared`. Expected: list, add, update and delete endpoints under `/api/productions/{productionId}/cast`.
- **Storage**: local files behind a storage interface, git-ignored, like the running order. The shape is chosen in the first story.
- **Starting list**: `cast.csv` ("Scout" and "Explorer" map to Scouts and Explorers, and blanks to not set) is git-ignored, converted once into local data, and never committed.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Young people's full names and groups become reachable by people outside the team | L (local only today) | H | Keep the data local and git-ignored. Access control, with an ADR, before any hosting. No names in logs or tests |
| A cast member is deleted by mistake | M | M | Confirmation names the person. Re-adding is quick. A permanent delete is the agreed trade-off for data minimisation |
| The list drifts from group registration lists | M | L | Group and section stay editable. Gaps (no section or group) are visible through the "Not set" filter |
| Two people edit the same cast member at once | L | L | FR7 refuses the stale change and shows the current list |

## Open questions

- Should the app warn when adding someone whose first and last name match an existing cast member? Owner: production team.
- Is "Network" expected in the 2027 cast, or kept for completeness? Owner: production team.
