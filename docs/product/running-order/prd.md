---
feature: running-order
status: approved
owner: cpthirst
date: 2026-10-10
---

# Running order: PRD

## Problem

The running order lives in a Word document ("GS 2027 DRAFT PROGRAMME", now at Draft 6). During casting meetings the production team often reorders items to avoid clashes, such as a performer with no time for a costume change between back-to-back items. Each change means someone edits the document, renumbers items, re-adds the timings, and circulates "v7".

That process causes three problems:
- It's slow in the meeting.
- Numbering and totals drift. Items not printed in the show programme are unnumbered but still take stage time.
- Nobody is sure which version is current.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting (directors, item leaders) | See the whole show at a glance and try a different order quickly, with numbering and timings updating straight away |
| Stage management, wardrobe | Know the current order and roughly when each item starts |
| Anyone on the team, later | Trust that what they see is the latest version, and that earlier versions are kept |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Reordering is quick in a meeting | Actions to move an item to a new position, including into the other half | 1 drag, or a few button presses without dragging |
| Trying ideas out is safe | Actions to throw away unsaved changes and get back to the last saved draft | 1 (Reset) |
| Changes are never lost | Changes silently overwritten when two people edit at once | 0. The later save is refused, and the person is told |
| Every saved draft is recoverable | Saved drafts kept as a numbered version | 100% |
| Timings can be trusted | Running clock for Draft 6 matches the document (interval 8:22 pm, second half 8:42 pm, finish 9:44 pm) | Exact match |
| Feels instant | Time for a move to show on screen; time for a save to complete (local setup) | Move: instant. Save: under 1 second |

## Non-goals

- Casting people into items, and clash detection. These are later features that build on this one.
- A screen for browsing or restoring past versions. Versions are kept (FR11), but there's no UI for them yet.
- More than one production on screen, or switching between years. 2027 is the only production for now.
- Printing or exporting the programme, or importing Word documents in the app. Draft 6 is converted once, by hand.
- Hosting outside a developer's machine (a later story and ADR).
- Sign-in. The app is planned as open access for the production team (see Constraints).
- Editing the show start time or interval length in the app. They're set once per production.
- A separate status for TBC items such as Yaputcha. "Printed in programme" plus comments is enough.
- Undo of a single move, and restoring an earlier saved draft. Reset discards all unsaved changes at once.
- Sharing unsaved changes between people. They live in one browser until saved.
- Adding and removing items in the app (FR10, deferred).

## Functional requirements

- **FR1**: The app must show the current running order in two halves (First half and Second half). For each item it shows the number, title, cast, stage, leads, comments and timing guideline (minutes). It also shows the current version number.
- **FR2**: Item numbers must be worked out from each item's position in its half, counting only items printed in the show programme. Items not in the printed programme are visibly marked and have no number.
- **FR3**: The app must show a running clock, calculated from the show's start time (7:15 pm for 2027) and the interval length (20 minutes):
  - each item's start time;
  - each half's total minutes;
  - when the interval starts and ends;
  - the projected finish.

  An item with no timing counts as 0 minutes and is flagged as untimed.
- **FR4**: Users must be able to reorder items by drag and drop, both within a half and between the two halves.
- **FR5**: Users must be able to make the same moves without dragging: move up, move down, and move to the other half. These work by keyboard and by single taps or clicks.
- **FR6**: Reorders and edits must show at once, with numbering and the running clock updated, as **unsaved changes** clearly marked as such. They stay in the user's browser until the user chooses **Save as Draft N+1**, which saves them all as one new version (Draft 6 → 7). **Reset** must discard all unsaved changes and show the last saved draft again. Save and Reset are only available when there are unsaved changes. Leaving the page with unsaved changes asks for confirmation first.
- **FR7**: If someone else saved a newer version since the user's last view, the user's save must not be applied. The user is told, and shown the latest version. Their unsaved changes are discarded.
- **FR8**: A saved change must keep exactly the same set of items: no item lost, duplicated or invented.
- **FR9**: Users must be able to edit an item's details: title, cast, stage (a sequence of Apron or Full), leads, comments, timing and whether it's printed in the programme.
- **FR10** (deferred 2026-10-10): Users must be able to add a new item to either half and remove an item. Removing asks for confirmation. Not planned for now; items change by editing.
- **FR11**: Every saved version must be kept, with its number and the time it was saved, so it can be recovered or viewed later.
- **FR12**: Draft 6 of the 2027 programme must be available as the starting version, held locally and never committed to the repository.

## Non-functional requirements

- **Security**:
  - **Access:** no sign-in is planned (see Constraints). For now the API and data stay on the developer's machine, and the API listens on loopback only.
  - **Input:** all input is validated against the shared contract, with text lengths capped.
  - **Personal data:** the running order holds only item details and adult leads' first names. It holds no young people's names, consistent with CLAUDE.md's safeguarding rules.
  - **Real data:** the real programme stays out of git (FR12). Tests use made-up items.
- **Accessibility**: WCAG 2.2 AA, including 2.5.7 Dragging Movements, which FR5 satisfies. Moves and saves are announced to screen readers. The not-printed and untimed markers don't rely on colour alone. The page is usable at 360px width.
- **Performance**: the running order (about 25 items) loads in under 1 second locally. Saves complete in under 1 second (see Goals).

## Constraints and assumptions

- **Data shape:**
  - One self-contained document per production version: the halves, the items and the clock settings.
  - Items have stable IDs, so a reorder never confuses one item with another.
  - Numbers and times are always calculated, never stored.
- **Storage:**
  - Now: local files behind a storage interface. Each version is a complete snapshot, and earlier versions are never edited.
  - Later: a managed store (DynamoDB is the expected choice), recorded in an ADR when hosting is decided.
  - "Someone else saved first" is detected by version number (FR7).
- **API:** Lambda-shaped handlers per ADR 0006. The request and response shapes live in `packages/shared`.
- **Dependency:** drag and drop needs a library with touch support (`vue-draggable-plus` / SortableJS is expected), recorded in an ADR in the first story that needs it.
- **Draft 6:** the `.doc` stays in `docs/product/running-order/` locally but is git-ignored. Its data is converted once into the local Draft 6 version.
- **Open access:** the production team has decided the app is low-risk and open access, with no sign-in. That suits the running order, which holds item details and adults' first names. Before any young person's data is stored on a shared host, access must be revisited (CLAUDE.md safeguarding rules).
- **Clock settings:** the show start time (7:15 pm) and interval length (20 minutes) are part of the production's data, not edited in the app.
- **Assumption:** "Comments / Squad" in the document mixes leads and notes. They become two fields: leads (names) and comments.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unsaved changes are lost when a browser closes or someone else saves first | M | M | Changes are clearly marked as unsaved, leaving the page asks first, and saving is one click. A conflict discards only that person's unsaved moves |
| Two people editing in the same meeting refuse each other's saves | M | M | FR7 shows the latest version immediately, so the second person repeats their moves on current data |
| The real programme leaks into git | L | M | Git-ignore the `.doc` and the data folder, and check with `git status` in review |
| A drag misfires on a phone and moves an item by accident | M | L | Nothing is saved until Save, so Reset or the opposite move fixes it. Move buttons give precise control |

## Open questions

- None. Changed 2026-10-10: saving is now explicit (Save as Draft N+1 and Reset), not on every change. Resolved 2026-10-10: start time and interval aren't editable in the app, TBC items need no status of their own, and the app is open access (see Constraints).
