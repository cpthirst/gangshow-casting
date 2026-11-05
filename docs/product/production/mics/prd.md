---
feature: production-mics
status: approved
owner: Nick Hirst
date: 2026-11-02
---

# Production Mic plot: PRD

## Problem

The show has **24 radio mic channels**, so no more than 24 cast members can wear a mic at once. Tech plans who wears which mic in each item in a spreadsheet (the 2026 Mic Plot is an example file, not the one for the 70th show): each item has a block of 24 channels, each showing a cast member and their role. It's typed by hand and kept apart from the running order and the casting. Nothing stops a channel being given to someone in the item straight after it was used by someone else, so there's no time to take the mic off one person, check it and fit it on another. When casting or the running order changes, the spreadsheet goes out of date and nobody notices.

Each item's Mic plot page in the app only says "Coming soon" (production-overview FR10).

## Users

| User                                                                       | Need                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tech team, with Tech permission                                            | Give each of the 24 channels to a cast member and role for each item, without being able to plan a changeover there isn't time for |
| Director, with Director permission                                         | Change the mic plot, as every Production department's pages (production-scenery FR2)                                               |
| Sound desk, during the show                                                | A printed mic plot, item by item, laid out like the spreadsheet they already use                                                   |
| Everyone else signed in (Casting, Stage, Wardrobe, Read-Only Team Members) | See who has which mic in any item, without being able to change it                                                                 |
| Admin                                                                      | Manage the mic plot themselves                                                                                                     |

## Goals and success metrics

| Goal                                  | Metric                                                                                                                                   | Target                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| No impossible changeovers are planned | Channels given to a different cast member in the item straight after another used them (within the same half), across the saved mic plot | 0                     |
| The mic plot matches the casting      | Allocations to someone not cast in the item, or to a role the item doesn't have                                                          | 0                     |
| Allocating is quick                   | Time to give a channel to a cast member and role on an item's Mic plot page                                                              | Under 10 seconds      |
| The printed plot needs no retyping    | Steps from the Overview to the Excel mic plot                                                                                            | 1 (Generate Mic Plot) |
| Access matches what someone does      | Changes the API accepts outside an account's permissions, covered by tests for every new change route and every permission               | 0                     |
| Mic plot data is never public         | Mic plot pages, data or exports reachable by anyone who isn't signed in                                                                  | 0                     |

## Non-goals

- **Warnings or info icons.** A channel that can't be used is simply greyed out; there are no warning badges, pop-ups or clash reports. The one exception is an allocation kept after a reorder (FR10), flagged as an Error.
- **Automatic allocation** or suggestions for which mic someone should have.
- **Hand-held or other mics, packs, frequencies, batteries or spares.** Only the 24 radio mic channels, numbered 1 to 24.
- **More or fewer than 24 channels**, or naming channels. The number is fixed.
- **Changing casting from the Mic plot page.** Who is in an item and its roles stay on the Casting pages.
- **Timings within an item**, such as a mic switched off for dialogue. That goes in the notes.
- **Spare-mic rules beyond the item before.** Only the item directly before is checked, however short it is.
- **Importing** the existing spreadsheet.
- **New permissions.** Mic plot belongs to Tech, which exists.

## Functional requirements

### Who can change it

- **FR1**: Admins and anyone with **Tech** or **Director** can change an item's mic plot and its notes. Everyone else, whatever their permissions, can view it, and sees the line saying what can be viewed but not changed and who can change it, as on the other department pages (production-scenery FR5). The API refuses every change outside these permissions, however the request is made (production-props FR4).

### An item's Mic plot page

- **FR2**: Each item's Mic plot page (production-overview FR10) replaces "Coming soon" with **all 24 channels, Mic 1 to Mic 24, in order**, always all of them, used or not. The page keeps its link back to the Overview, its Previous and Next links, and its not-found message.
- **FR3**: Each channel has a **cast member**, chosen from the cast members cast in that item, and shows their **role**: every role that cast member plays in the item, ensembles included, biggest part first, as plain text. The role is never chosen or saved: it is worked out from the casting, so it always matches it (decided 2026-11-03). Clearing the cast member frees the channel.
- **FR4**: A cast member can be on **only one channel in an item**. Someone already on a channel in this item isn't offered for another.
- **FR5**: A channel used in the **item directly before** (in the same half) by a different cast member **can't be allocated** in this item, however short that item is. It is shown **greyed out and disabled**, with "Used in previous item" as its visible text, and it can't be chosen by mouse, keyboard or screen reader. The cast member who had that channel in the item before can keep it in this item: for them the channel is open.
- **FR6**: The rule in FR5 **resets at the interval**: the first item after the interval, and the first item of the show, can use any channel.
- **FR7**: A cast member can keep the same channel across items that aren't back to back (for example items 1 and 3) without anything extra to do; it's simply allocated in each.
- **FR8**: Each item's Mic plot page has **Mic plot notes** under the channels, changed by the same people who can change the channels (FR1), as the Scenery page has Scenery notes.

### When casting or the running order changes

- **FR9**: When a cast member is taken out of an item or out of the cast, their channel in that item is freed. When a casting role is removed, or its cast member changes, any channel with that role keeps its cast member, if they're still in the item, with the role left blank.
- **FR10**: When the running order changes so that an existing allocation now breaks FR5, the allocation is kept and shown, but that channel can only be cleared, not changed, until it's cleared. Nothing is removed without someone choosing to. Until then it is flagged as an **Error**, as a casting clash is (casting-rules FR7–FR11): an Error icon on that channel on the item's Mic plot page, describing the channel and both items, and on that item's Mic plot count on the Overview.
- **FR11**: Each item's mic plot belongs to that item in the current production and goes with it when it moves in the running order. When an item is removed from the running order, its mic plot and notes are deleted in the same removal clean-up as its other department data (production-scenery FR12, FR13).

### The Overview

- **FR12**: The Overview's **Mic plot** count column shows the number of channels allocated in each item ("6" over "mics", "1" over "mic", "0" when none), instead of a dash (production-overview FR14). Screen readers hear it as one phrase ("6 mics").
- **FR13**: An item's Mic plot notes appear in full under its row on the Overview, labelled, in button order (after SFX notes, before Wardrobe notes) (production-overview FR6).
- **FR14**: The Overview has a **Generate Mic Plot** button beside Generate Props List (production-overview FR8). Anyone signed in can use it. It downloads an Excel workbook of the whole show's mic plot, laid out as the 2026 Mic Plot:
  - a title row, "CHESTER GANG SHOW <year> - MIC PLOT", then each half headed "ACT 1" and "ACT 2";
  - one block per item, in running order, with the item's title in the first column beside the whole block;
  - in each block, the channels in rows of nine (Mic 1–9, Mic 10–18, Mic 19–24), each with a header row ("Mic 1"…), the cast member's first name and surname under it, and the role under that; unused channels left blank;
  - the item's Mic plot notes beside the block, under a "Notes" heading;
  - each item's block shaded in its own colour, so neighbouring items are easy to tell apart; the same sequence of colours starts again at the top of each half;
  - bold headers, centred cells with thin borders, sized to print on A4 portrait.

### Help and Usage

- **FR15**: The Welcome and Help pages describe the Mic plot page: the 24 channels, choosing a cast member and role, why a channel is greyed out (used by someone else in the item before), that it resets at the interval, notes, who can change it, and Generate Mic Plot.
- **FR16**: The Usage page records visits to each item's Mic plot page, as it records the other department pages, and uses of Generate Mic Plot, as it records Generate Props List.

## Non-functional requirements

- **Security and safeguarding**:
  - Every read, change and export needs a signed-in account; the API enforces FR1, FR3, FR4 and FR5 itself, so a request can't allocate a blocked channel, a cast member not in the item, or someone twice.
  - No new personal data. The mic plot links existing cast members and roles to channel numbers; it shows only first name, surname and role. The Excel export holds the same, like the existing Word exports, and Help reminds the team it contains under-18s' names and is for the production team only.
  - Cast names in the page and the workbook are shown as text, never as markup or spreadsheet formulas (a name starting with "=" stays text).
  - Test data and fixtures use made-up names only. The 2026 reference spreadsheet holds real names and is never committed.
- **Accessibility**: WCAG 2.2 AA. Each channel's inputs are labelled with the channel ("Mic 7 cast member", "Mic 7 role"); a disabled channel's reason is in its accessible name, not only its colour; greyed out still meets contrast for its text; targets are at least 24 by 24 CSS pixels; the page works by keyboard; it works at 320px and 360px with no sideways scrolling, 24 channels included.
- **Performance**: An item's Mic plot page, including which channels are blocked, shows in under 1 second for a show of about 25 items. A change saves in under 1 second. Generate Mic Plot for the whole show downloads in under 3 seconds.

## Constraints and assumptions

- Builds on casting (items, cast members, roles and who is cast in them), the running order (its halves and order) and production-overview (the Mic plot item page, its button and count column, the Overview's export buttons). Builds on production-scenery's department permissions and removal clean-up.
- Cost stays close to £0 within the existing £5 budget alert, with no new AWS service.
- One production (2027). Deploys stay the maintainer's (CLAUDE.md).
- **Assumption**: there are always exactly 24 channels, numbered 1 to 24.
- **Assumption**: Mic plot is Tech's, with Director and Admins (production-overview's department assumption).
- **Assumption**: making an Excel file may need a new library; if so, it's chosen in the story that adds the export, with an ADR if it's a runtime dependency.
- **Decided 2026-11-02**: a channel used in the item directly before is greyed out, not warned about; the cast member who had it can keep it; the rule resets at the interval; cast members and roles come from the item's casting only, and a cast member in the item without a named role (chorus, harmonies) can have a mic with the role left blank; one notes field per item; the export follows the 2026 Mic Plot's layout.

## Risks

| Risk                                                    | Likelihood | Impact | Mitigation                                                                                         |
| ------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
| Reordering items makes saved allocations break the rule | M          | M      | FR10 keeps them visible and clearable, never silently deleted                                      |
| A chorus member needs a mic but has no role in casting  | H          | L      | Their ensemble shows as the role (FR3); casting can add a role                                     |
| 24 channels with two pickers each don't fit at 320px    | M          | M      | One channel per row on narrow screens; browser layout tests at 320px and 360px (ask before adding) |
| The exported workbook is shared outside the team        | L          | H      | Same handling as the Word exports; Help reminds the team; only signed-in accounts can generate it  |
| A name is read as a spreadsheet formula                 | L          | M      | Names written as text; a test with a name starting "="                                             |
| Casting changes free a channel without Tech noticing    | M          | L      | The Overview's Mic plot count changes; Tech checks the page before the show                        |

## Open questions

None open.

### Resolved

- FR10: an allocation that a reorder makes break the rule is kept, and can only be cleared, never freed automatically. Decided 2026-11-02.
- FR10: that kept allocation is flagged as an Error on the item's Mic plot page and on the Overview, following the casting clash pattern; the only exception to the no-icons non-goal. Decided 2026-11-05.
- FR3: a cast member in the item without a named role can have a mic with the role left blank. Decided 2026-11-02.
- FR14: the export shades each item's block in its own colour, with the colours repeating in each half. Decided 2026-11-02.
