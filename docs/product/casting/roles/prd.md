---
feature: casting-roles
status: approved
owner: cpthirst
date: 2026-10-15
---

# Casting roles: PRD

## Problem

Casting decisions are made in meetings and rehearsals, and the parts in an item change as it's developed. Today those decisions go into free-text notes and a shared document, so nobody can reliably say which parts exist, how big they are, or who has them. The team needs to record each part as it's decided, and fill it in later when the person isn't chosen yet, quickly enough to keep up with a live meeting.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting | Add a part and, if it's decided, who plays it, without slowing the meeting down |
| Item leaders after a rehearsal | Fill in an uncast part, recast someone, or tidy up parts that have changed |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Recording a part keeps up with the meeting | Time to add a role with a cast member, by someone who has done it before | Under 30 seconds |
| Finding the right person is quick | Characters typed to narrow a 56-person cast to the right person | 4 or fewer in most cases |
| Casting data stays trustworthy | Roles saved with invalid data, or overwriting someone else's newer change | 0 |

## Non-goals

- Rules and warnings, such as a person appearing in back-to-back items (casting rules PRD).
- Reordering roles by hand. Their order is fixed (casting-item-overview FR4).
- Copying roles between items or from a previous production. Each production is self-contained (CLAUDE.md).
- Deleting roles when their item is removed from the running order (see casting-items, Open questions).
- Target sizes for ensembles (how many people are wanted).
- Adding new people to the cast from this form. That stays on the Cast page.

## Functional requirements

- **FR1**: At the top of an item's page (casting-item-overview), users must be able to **add a role**, with a form like "Add cast member" that has these fields:
  - **Role name**: required.
  - **Role size**: required, one of lead, support, cameo or ensemble.
  - **Cast member**: optional, at most one person. It can be left blank, which adds the role uncast.
- **FR2**: The Cast member field must be a text-filterable search of the production's cast list. Typing narrows the choices by first and last name, ignoring case and accents, as on the Cast page. Users can pick a match with the keyboard or by tap or click.
- **FR3**: Invalid details must be explained next to the field, and nothing saved:
  - a missing role name, or one over the length limit;
  - a missing role size;
  - a role name already used by another role in the same item, ignoring case.
- **FR4**: Users must be able to **edit a role**: change its name and size, cast someone in an uncast role, change who is cast, or make it uncast. The same validation applies (FR3).
- **FR5**: For an **ensemble** role, editing must let users add and remove cast members. Each person can be in an ensemble role only once. The add form (FR1) still takes at most one person, the first, unless Add all cast is used (FR11).
- **FR6**: Changing a role from ensemble to lead, support or cameo must be refused while it holds more than one cast member, with an explanation.
- **FR7**: Users must be able to **remove a role** after confirming. The confirmation names the role. Removing it also removes who was cast in it.
- **FR8**: Adding, editing and removing must each save straight away and show on the item's page and the Items counts (casting-items FR2). If someone else changed or removed that role since the page was loaded, the change isn't applied. The user is told, and shown the item's current roles.
- **FR9**: When a cast member is deleted from the cast list (cast-management FR5), they must also be removed from every role they were in, leaving those roles uncast if nobody else is in them.
- **FR10**: A cast member may be cast in more than one role in the same item, and in any number of items.
- **FR11**: When adding or editing an **ensemble** role, an **Add all cast** button beside the ensemble's members list must add to the ensemble everyone on the cast list who isn't already in a role in this item. Parts in other items don't matter.
  - When nobody is left to add, the button can't be pressed, and the form says "Everyone is already in a role in this item".
  - An ensemble holds at most 200 people; if Add all cast takes it past that, saving explains it rather than failing silently.
  - It only fills the form. The user can still remove people before pressing Save, and Cancel leaves the role as it was.
  - It checks no casting rules. It's a quick way to fill an ensemble, and any clashes it causes show afterwards as usual (casting-rules).
  - (Added on 2026-10-16 at the user's request. After review, also at the user's request: the button moved from beside Save and Cancel to beside the members list, its label became "Add all cast", and the add form shows the members list as soon as Ensemble is chosen.)

## Non-functional requirements

- **Security and safeguarding**:
  - Casting links young people's names to parts, so it's personal data (ADR 0010).
  - Roles store a reference to the cast member, never a copy of their name, so deleting someone removes them everywhere (FR9).
  - The data stays local and git-ignored, and the API listens on loopback only. Before casting data is served from anywhere shared, access must be limited to the production team, with its own story and ADR (CLAUDE.md).
  - Input is validated by the shared schema. No names appear in server logs. Tests use made-up names.
- **Accessibility**: WCAG 2.2 AA. The cast member search follows the combobox pattern: its options and how many match are announced, and it can be used by keyboard alone. Errors are shown next to the field. Removing a role asks for confirmation. Everything works at 360px width.
- **Performance**: the search narrows as you type with no noticeable delay for a cast of up to about 200. Saves complete in under 1 second locally.

## Constraints and assumptions

- **Fields**:
  - Role name: free text, trimmed, up to 60 characters (assumed), and unique within its item, ignoring case.
  - Role size: lead, support, cameo or ensemble.
  - Cast members: references to the production's cast list by ID. At most one for lead, support and cameo; any number for ensemble.
- **Roles belong to an item** in one production, through the item's stable running-order ID. They never carry over between productions.
- **Stale changes**: each role carries a revision that goes up on every change, like cast members (cast-management FR7).
- **Storage**: local files behind a storage interface, git-ignored, like the cast list and running order. The shape is chosen in the first story. Removing a role deletes it outright, with no history, because it holds personal data (ADR 0010).
- **API**: Lambda-shaped handlers (ADR 0006), with shapes in `packages/shared`.
- **Assumption**: the add form stays at the top of the item's page, so it's visible when the page opens.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two cast members share a first and last name, and the wrong one is picked | L | M | Show section and group in the search results to tell them apart |
| Adding an ensemble one person at a time is slow for large ensembles | M | M | Watch it in the first casting meeting. A bulk-add story can follow |
| Removing a role by mistake loses who was cast in it | M | L | The confirmation names the role. Re-adding is quick |
| A deleted cast member is left in roles | L | H | FR9, tested across the cast and roles stores |

## Open questions

- Is 60 characters enough for a role name? Owner: production team.
- Should search results show section and group alongside the name? Assumed yes. Owner: production team.
- Should ensemble members be addable in bulk (several at once) when editing? Owner: production team, after the first casting meeting.
