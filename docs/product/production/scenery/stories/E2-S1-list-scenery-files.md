---
id: production-scenery.E2.S1
title: List an item's scenery files from file storage
epic: E2
status: draft
---

## Story

As someone on the production team, I want an item's Scenery page to show the files kept for it, so that I can see the item's set plans and designs in one place, next to the running order.

## Acceptance criteria

### AC1: The page shows the item's files as a grid, by name
Given "Opening Number" has "set-plan.pdf" (2.4 MB), "Backdrop.png" (800 KB) and "build-list.xlsx" (40 KB) in file storage
When someone opens its Scenery page
Then it shows a tile for each, sorted by name: Backdrop.png, build-list.xlsx, set-plan.pdf
And each tile shows the file's name and size, with a general file icon

### AC2: The names come straight from file storage
Given "Opening Number" has "set-plan.pdf" in file storage
When the file is renamed "set-plan-v2.pdf" directly in file storage, outside the app
And someone opens or reloads the item's Scenery page
Then the tile shows "set-plan-v2.pdf", and no tile shows "set-plan.pdf"

### AC3: A file added outside the app shows too
Given "Opening Number" has no files
When "lighting.pdf" is put in the item's place in file storage, outside the app
And someone opens its Scenery page
Then it shows a tile for "lighting.pdf"

### AC4: An item with no files says so
Given "Finale" has no files
When someone opens its Scenery page
Then it says "No scenery files for this item yet." in place of "Coming soon"

### AC5: Each item shows only its own files
Given "Opening Number" has "set-plan.pdf" and "Finale" has "curtain.pdf"
When someone opens the Scenery page for "Finale"
Then it shows "curtain.pdf" only

### AC6: Files stay with an item when it moves
Given "Opening Number" has "set-plan.pdf" and is first in the running order
When the running order is saved with it moved to third
Then its Scenery page still shows "set-plan.pdf"

### AC7: A name is shown as text
Given a file named "<b>plan</b>.pdf"
When someone opens the item's Scenery page
Then the tile shows the name exactly as "<b>plan</b>.pdf", not as bold text

### AC8: Every signed-in role can list the files
Given "jo" has no permissions
When jo opens the Scenery page for "Opening Number"
Then jo sees its files, as an admin does

### AC9: Nobody signed out can list or reach the files
Given someone who isn't signed in
When they ask the API for an item's files, or ask file storage for a file directly
Then the API answers 401 and file storage refuses them

### AC10: The page keeps its links and not-found message
Given the Scenery page for item 2 of 3
When someone uses its links
Then one goes back to the Overview, and Previous and Next go to the Scenery pages for items 1 and 3
And an item that isn't in the latest saved running order still shows "not found" with a link back

### AC11: The Overview's Scenery button follows the new access
Given "lee" has Tech only and "pat" has Stage only
When each reaches the Scenery button for "Opening Number" with a screen reader
Then for each it is named "Edit scenery for Opening Number"
And for someone with Casting only it is named "View scenery for Opening Number"

### AC12: The read-only line names who can change scenery
Given "sam" has Casting only
When sam opens a Scenery page
Then it shows "You can view the scenery, but not change it."
And someone with Stage, Tech or Director, or an admin, sees no such line

## Notes

- FRs: FR5 (who sees the read-only view), FR6, FR7 (grid, name and size, general icon), FR12
- Depends on: production-scenery.E1.S1
- **ADR for file storage** (via the `adr` skill), with the infra and security reviews. It decides:
  - **Where files live**: new private file storage (for example an S3 bucket), never public, encrypted, blocked from public access, in the stack's region. It's a new AWS resource, so the stack's tests and `pnpm check:hosted` cover it.
  - **File names live in file storage, not the database** (the maintainer's preference, 2026-10-29). The API lists the item's place in file storage on each request, and the page shows what comes back, so a file renamed, added or removed directly in storage shows on the next load (AC2, AC3). The ADR explores the options for how a name changed at source is shown, for example:
    1. the name is the last part of the file's storage key, under a folder per production and item (`<production>/<item id>/<name>`). Renaming at source (on S3, a copy to the new key and a delete of the old one) shows straight away. No database rows.
    2. a generated key per file, with the name held in the file's metadata. A rename at source means editing metadata, which the S3 console makes awkward, and listing needs a request per file to read it.
    3. names in the database beside a generated key (rejected by the maintainer: a rename at source would leave the database out of step).

    For option 1, it also settles which characters a name may hold, so that a name can't reach outside its item's folder (the PRD's "a file's name can't choose where in storage the file goes", read as: not outside its item's own folder), and how a long listing is paged.
  - **Scoping**: folders are per production and per item ID, so items moving keep their files (FR12) and nothing carries over between productions.
  - **Local development and the demo**: where files live when running locally (a local folder, or a separate store), and whether `pnpm dev` uses the real bucket, as it uses the real table.
  - **Cost** within the existing £5 budget alert.
- A file "renamed directly in storage" in AC2 and "put in storage" in AC3 are done in tests through the store, not through the app, which can't rename (non-goal).
- Story map: this story was the walking skeleton with upload. It was split at `write-story` because storage, the ADR, both stores and the page already make a full PR. Uploading is E2.S7.
- Offer the maintainer a browser layout walk of a Scenery page with long file names, at 320px and 360px (CLAUDE.md: ask first).
- Out of scope: uploading (E2.S7), downloading (E2.S2), thumbnails and type icons (E2.S3), deleting (E2.S4).
