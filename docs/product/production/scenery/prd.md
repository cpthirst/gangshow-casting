---
feature: production-scenery
status: approved
owner: Nick Hirst
date: 2026-10-29
---

# Production scenery: PRD

## Problem

The scenery for each item is designed, built and rigged by different people across Stage and Tech. Their set plans, designs, build lists and reference photos are shared over WhatsApp and email, kept in separate shared drives, or stay on paper with whoever drew them. Files get lost in chat threads, nobody is sure which version is the latest, and none of it sits next to the running order. A stage manager looking at an item in iCUE can't see its scenery, because each item's Scenery page only says "Coming soon" (production-overview FR10).

Access doesn't fit the production team either. The show's director works across every production department (scenery, props, sound, mics and wardrobe), but not on casting. Today only an Admin can change every department, and making the director an Admin would also give them casting and the admin-only actions.

## Users

| User | Need |
|---|---|
| Stage team, with Stage permission | Put an item's set plans, designs and photos in one place, and find the latest version at rehearsal |
| Tech team, with Tech permission | Add and fetch the scenery files they need to rig and light an item, such as hanging plots |
| Director, with the new Director permission | Change every production department's pages (Scenery, Props, SFX, Mic plot, Wardrobe) without being able to change casting or the show |
| Casting team, Wardrobe and Read-Only Team Members | View and download any item's scenery files, without being able to change them |
| Admin | Give someone the Director permission, and manage scenery files themselves |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Scenery files live with the item | Places the team needs to look for an item's scenery files | 1 (its Scenery page) |
| Sharing a file is quick | Time to upload a file to an item, starting on its Scenery page | Under 30 seconds, plus the upload itself |
| Files are recognisable at a glance | Files on a Scenery page shown without a type icon | 0 |
| Access matches what someone does | Changes the API accepts outside an account's permissions, covered by tests for every change route and every permission, Director included | 0 |
| Nobody's access changes in the release | Existing accounts whose access changes with no admin action | 0 |
| Scenery data is never public | Scenery files reachable by anyone who isn't signed in | 0 |

## Non-goals

- **Folders, tags, or a description per file.** A file is its name, type and size.
- **Renaming a file in the app.** It keeps the name it was uploaded with.
- **Versions or history.** Replacing a file keeps only the newest copy, and a deleted file can't be brought back.
- **Viewing or editing files inside the app**, image thumbnails included (E2.S3 dropped 2026-10-29). A PDF, image or plain-text file opens in the browser's own viewer, in a new tab; every other file downloads.
- **Checking what is in an image**, such as spotting photos of people. The page states the rule (FR8), and the team follows it.
- **Deleting files at the end of a production.** Not considered for now.
- **Recording uploads, downloads or deletes on the Usage page.** Only page visits are recorded (FR15).
- **Files for the whole show** rather than one item, and files that carry over between productions (CLAUDE.md).
- **A scenery count or file list on the Overview.** The Scenery button is unchanged (production-overview). Revisit if the team asks.
- **Files for other departments' pages** (Props, SFX, Mic plot, Wardrobe). Each decides for itself when it's built.
- **Director access to Casting or the show**: the cast, roles, casting, casting item notes and the running order stay with Casting and Admin.
- **Admin-only actions for anyone but Admins**, Directors included.
- **Permissions finer than this**, such as "scenery but not props", or permissions that differ by production.

## Functional requirements

### Director permission
- **FR1**: A new permission, **Director**, joins Casting, Stage, Tech and Wardrobe. It is a tick box like theirs, so it can be combined with any of them. An Admin still can't also have permissions (production-props FR1).
- **FR2**: Director lets an account change every Production department's data: Scenery, Props (props and props notes), SFX, Mic plot and Wardrobe, including each one's pages as they're built. It doesn't let an account change the cast, roles, casting, casting item notes or the running order, or do anything admin-only.
- **FR3**: Director appears wherever the other permissions do, with the same rules: the Accounts page's tick boxes and confirmations (production-props FR6), the "Local role" switch in local development and the demo (production-props FR9), and the refusal and read-only lines (production-props FR3).
- **FR4**: The API refuses every change outside the account's permissions, Director included, however the request is made (production-props FR4). Adding Director changes no existing account's access.

### Who can change scenery
- **FR5**: Admins and anyone with **Stage**, **Tech** or **Director** can upload and delete scenery files. Everyone else, whatever their permissions, can view and download them, and sees the line saying what can be viewed but not changed.

### An item's Scenery page
- **FR6**: Each item's Scenery page (production-overview FR10) replaces "Coming soon" with the item's files. The page keeps its link back to the Overview, its Previous and Next links, and its not-found message.
- **FR7**: The files are shown as a **grid** of tiles, sorted by name. Each tile shows:
  - a **type icon**: distinct icons for PDF, Word, Excel, PowerPoint and images, and a general file icon for any other type. There are no thumbnail previews (dropped 2026-10-29);
  - the file's **name**, exactly as it is held in storage (the name it was uploaded with), with its size;
  - for those who can change scenery, a **trash icon** to delete it.

  An item with no files says so, and, for those who can change scenery, how to add one.
- **FR8**: Someone who can change scenery can **upload** a file, one at a time, of any type, up to **100 MB**. The upload area says "Scenery and set images only: no photos of cast members." The page shows progress while the file uploads. A file over the limit, or an upload that fails, is named with the reason.
- **FR9**: Uploading a file with the same name as one already on that item **replaces** it, after the page asks to confirm ("Replace set-plan.pdf?"). Names are compared exactly, as stored.
- **FR10**: Anyone can **open or download** a file by choosing its tile. A PDF, image (JPG, PNG, GIF, WebP) or plain-text file opens in a new browser tab; any other file downloads. Either way it keeps its stored name.
- **FR11**: The trash icon asks to confirm ("Delete set-plan.pdf? This can't be undone."), then deletes the file for everyone.
- **FR12**: Each item's files are its own, tied to that item in the current production. Moving an item in the running order keeps its files with it.
- **FR13**: When an item is removed from the running order, its files are deleted along with everything else about it, in the same removal clean-up that runs when the running order is saved (running-order E3.S2). Nothing is deleted until the save, so Reset still undoes a removal. As with the item's notes and roles, a clean-up that fails is repaired by the next save.

### Help
- **FR14**: The Welcome and Help pages describe the Scenery page (uploading, replacing, downloading and deleting files, and the "no photos of cast members" rule), and the Director permission: what it can and can't change.

### Usage
- **FR15**: The Usage page records visits to an item's Scenery page, as it records visits to other item pages. Uploads, downloads and deletes are not recorded.

## Non-functional requirements

- **Security and safeguarding**:
  - Every upload, download, list and delete needs a signed-in account (ADR 0018). Files are never publicly reachable: not by guessing an address, and not through a link that outlives its use. Any download link expires within minutes.
  - The API enforces FR5 for every upload and delete, and checks the size limit itself, not only the page.
  - A file is never opened as a page of the app. Only types that can't run script (PDF, images other than SVG, plain text) open in the browser, and never from the app's own address; every other type, HTML and SVG among them, always downloads, so an uploaded HTML or script file can't run. A file's name is shown as text, never as markup, and can't choose where in storage the file goes.
  - Adding the Director permission and its sign-in group changes the AWS sign-in setup, and a Scenery page shared by Stage and Tech changes ADR 0026's rule that each change route names one permission. Both need a decision record amending ADR 0026, and the infra and security reviews.
  - The images rule (FR8) stands in for checks: the app stores no photos of cast members (CLAUDE.md, ADR 0010). Files hold no personal data the app relies on.
- **Accessibility**: WCAG 2.2 AA.
  - Each tile has an accessible name saying the file's name and type, and what choosing it does ("Open set-plan.pdf, PDF file", "Download build-list.xlsx, XLSX file"). Each trash icon's name says which file it deletes. Type icons are decorative to screen readers.
  - Upload works by keyboard, not only by drag and drop. Progress and errors are announced.
  - Targets are at least 24 by 24 CSS pixels (44 by 44 where the grid allows).
  - The page works at 320px and 360px with no sideways scrolling, long file names included (they wrap or are shortened with the full name available).
- **Performance**:
  - A Scenery page with about 30 files shows its grid in under 1 second.
  - Uploads and downloads go at the speed of the connection: the app adds no limit below 100 MB, and a slow upload doesn't block the rest of the page.

## Constraints and assumptions

- Builds on production-overview (each item's Scenery page, its links and not-found message) and production-props (department permissions, refusals, the Accounts page and the local switch). Items come from the latest saved running order, by their stable IDs.
- **File storage is new.** The app stores no files today. A 100 MB file is far bigger than one API request can carry (API Gateway caps a request at 10 MB), so files have to go to and from storage without passing through the API. That's a new AWS resource. It needs a story and an ADR (CLAUDE.md), and the infra review.
- Cost stays close to £0 within the existing £5 budget alert: a show's scenery files are expected to total a few GB at most.
- One production (2027). Deploys stay the maintainer's (CLAUDE.md).
- **Assumption**: Scenery is changed by Stage and Tech together, not only Stage. This revises the production-props and production-overview assumption that Scenery belongs to Stage. Chosen 2026-10-29.
- **Assumption**: same-name uploads replace the old file after a confirm (FR9). It's the simplest behaviour, chosen 2026-10-29 for that reason.
- **Decided 2026-10-29**: file names live in file storage, not the database. The API lists an item's files from storage each time, so a file renamed, added or removed there shows on the next load. The file storage ADR (E2.S1) explores how.
- **Decided 2026-10-29**: Director is a combinable tick box; files up to 100 MB of any type, uploaded one at a time; delete asks to confirm; images are covered by a stated rule, not checks.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A photo of cast members is uploaded | M | H | The rule on the upload area and in Help, files never public, and anyone who can upload can delete it at once |
| A file becomes reachable without signing in, e.g. a shared download link | L | H | Short-lived links, storage that's never public, security and infra reviews, a check in the post-deploy test (`pnpm check:hosted`) |
| Someone replaces or deletes the latest version by mistake | M | M | Both ask to confirm and name the file. There's no history (non-goal), so the release notes and Help say so |
| A 100 MB upload fails on a backstage phone connection | M | L | Progress shown, a clear error naming the file, and the user can retry |
| An uploaded file carries something harmful (script, malware) | L | M | Only types that can't run script open in the browser, away from the app's address; the rest only download. There's no scanning; revisit if files are shared beyond the team |
| Storage costs creep up | L | L | The 100 MB cap, the existing budget alert, and files tied to one production |
| Director widens access beyond Production, or Stage/Tech sharing a route breaks the one-permission rule | L | M | Tests for every change route with each permission (Director included) and with none, plus an ADR for the "any of these permissions" rule |

## Open questions

None open.

### Resolved

- A removed item's files are deleted with the rest of its data when the running order is saved (FR13). Decided 2026-10-29.
- Deleting files at the end of a production is out of scope for now (Non-goals). Decided 2026-10-29.
- The Usage page records only visits to the Scenery page (FR15). Decided 2026-10-29.
