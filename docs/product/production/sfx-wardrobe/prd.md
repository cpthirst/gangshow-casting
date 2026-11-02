---
feature: production-sfx-wardrobe
status: approved
owner: Nick Hirst
date: 2026-10-29
---

# Production SFX and Wardrobe: PRD

## Problem

Sound effects, music cues and costume designs travel the same way scenery files did before production-scenery: over WhatsApp and email, in separate shared drives, or on whoever made them's laptop. Nobody is sure which version of a cue or a costume design is the latest, and none of it sits next to the running order. Each item's SFX and Wardrobe pages only say "Coming soon" (production-overview FR10), while its Scenery page already holds its files.

The Tech team running sound needs to hear a cue quickly, at the desk or in rehearsal, without downloading it first and finding a player.

## Users

| User | Need |
|---|---|
| Tech team, with Tech permission | Put an item's sound effects and music in one place, and play the latest version straight away |
| Wardrobe team, with Wardrobe permission | Put an item's costume designs, patterns and reference images in one place, and find the latest at a fitting |
| Director, with Director permission | Change both pages, as every Production department's (production-scenery FR2) |
| Everyone else signed in (Casting, Stage, Read-Only Team Members) | View, play and download any item's SFX and Wardrobe files, without being able to change them |
| Admin | Manage both pages' files themselves |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| SFX and Wardrobe files live with the item | Places the team needs to look for an item's SFX or Wardrobe files | 1 each (its SFX or Wardrobe page) |
| A cue plays straight away | Steps from an item's SFX page to hearing an MP3, WAV, M4A, AAC or OGG cue | 1 (choosing its row) |
| Sharing a file is quick | Time to upload a file, starting on the item's SFX or Wardrobe page | Under 30 seconds, plus the upload itself |
| Files are recognisable at a glance | Files on either page shown without a type icon | 0 |
| Access matches what someone does | Changes the API accepts outside an account's permissions, covered by tests for every new change route and every permission | 0 |
| Scenery is unchanged | Scenery behaviours that change in the release | 0 |
| The files are never public | SFX or Wardrobe files reachable by anyone who isn't signed in | 0 |

## Non-goals

- **The Mic plot page.** It stays "Coming soon"; it's its own feature.
- **The SFX List (Word) export** beside Generate Props List (production-overview FR8). Its own feature.
- **A player on the page.** An audio file opens in the browser's own player in a new tab, as a PDF does (chosen 2026-10-29). No waveform, no looping, no cue buttons.
- **Cue numbers, cue order or timings** for sound effects. A file is its name, type and size, as on Scenery.
- **Who wears which costume**, sizes or measurements. Wardrobe holds files about an item, not about cast members.
- **Photos of cast members on Wardrobe**, fitting photos included (see FR4 and the risks).
- **Playing audio on the Scenery or Wardrobe pages.** An audio file there downloads, with the general file icon, as on Scenery today.
- **Everything production-scenery left out** applies to both pages: folders, tags or descriptions, renaming in the app, versions or history, thumbnails or viewing inside the app, checking what is in a file, deleting files at the end of a production, recording uploads, downloads or deletes on the Usage page, files for the whole show, and permissions finer than a department.
- **New permissions.** Tech, Wardrobe and Director already exist.

## Functional requirements

### Who can change them
- **FR1**: Admins and anyone with **Tech** or **Director** can upload and delete an item's SFX files and change its SFX notes. Admins and anyone with **Wardrobe** or **Director** can do the same on its Wardrobe page. Everyone else, whatever their permissions, can view, open and download them, and sees the line saying what can be viewed but not changed and who can change it, as on Scenery (production-scenery FR5). The API refuses every change outside these permissions, however the request is made (production-props FR4).

### An item's SFX and Wardrobe pages
- **FR2**: Each item's SFX page and Wardrobe page (production-overview FR10) replaces "Coming soon" with the item's files, laid out and behaving as its Scenery page does (production-scenery FR6, FR7): a list sorted by name, a trash icon on the left for those who can change it, a type icon, the full stored name and size, and a message when there are none saying, for those who can change it, how to add one. Each page keeps its link back to the Overview, its Previous and Next links, and its not-found message.
- **FR3**: Someone who can change a page can **upload** a file to it, as on Scenery (production-scenery FR8, FR9): one at a time, chosen or dragged onto the upload area, of any type, up to **100 MB**, with progress shown, a failed upload named with the reason and able to be tried again, and a file with the same name replacing the old one after a confirm.
- **FR4**: The Wardrobe upload area says **"Costume designs and images only: no photos of cast members."** The SFX upload area has no such line.
- **FR5**: Anyone can **open or download** a file by choosing its row, as on Scenery (production-scenery FR10): a PDF, image (JPG, PNG, GIF, WebP) or plain-text file opens in a new browser tab; any other file downloads, keeping its stored name.
- **FR6**: On the **SFX page only**, an **audio file** (MP3, WAV, M4A, AAC or OGG) shows the **audio file icon** in its type column, and choosing it opens it in a new browser tab, where it plays in the browser's own player instead of downloading.
- **FR7**: The trash icon asks to confirm ("Remove thunder.mp3? This can't be undone."), then deletes the file for everyone (production-scenery FR11).
- **FR8**: Each page has its own notes under the files, **SFX notes** and **Wardrobe notes**, as the Scenery page has Scenery notes, changed by the same people who can change the page's files (FR1).
- **FR9**: Each item's SFX and Wardrobe files are its own, tied to that item in the current production, and go with it when it moves in the running order. When an item is removed from the running order, its SFX and Wardrobe files and notes are deleted in the same removal clean-up as its scenery files (production-scenery FR12, FR13): nothing until the save, and a failed clean-up repaired by the next save.

### The Overview
- **FR10**: The Overview's **SFX** and **Wardrobe** count columns show each item's number of files, as the Scenery column does, instead of a dash (production-overview FR14). Screen readers hear each as one phrase ("3 SFX files", "1 wardrobe file").
- **FR11**: An item's SFX notes and Wardrobe notes appear in full under its row on the Overview, each labelled, after its scenery and props notes, in the order of the buttons (production-overview FR6).

### Help and Usage
- **FR12**: The Welcome and Help pages describe the SFX and Wardrobe pages: uploading, replacing, opening, downloading and deleting files, notes, who can change each, that SFX audio files play in a new tab, and Wardrobe's "no photos of cast members" rule.
- **FR13**: The Usage page records visits to each item's SFX and Wardrobe pages, as it records Scenery's (production-scenery FR15). Uploads, downloads, plays and deletes are not recorded.

## Non-functional requirements

- **Security and safeguarding**:
  - Everything in production-scenery's security requirements applies to both pages: every list, upload, open, download and delete needs a signed-in account; files are never publicly reachable; links expire within minutes; the API enforces FR1 and the size limit itself; a file is never opened as a page of the app; a name is shown as text and can't choose where in storage the file goes.
  - Audio files open in the browser only on the SFX page, and only the five types in FR6, which can't run script. The type a file opens as comes from its name, as on Scenery, never from storage or the uploader.
  - Each page's files are reachable only through its own routes: SFX's routes never reach Wardrobe's or Scenery's files, and the other way round. The API's access to file storage widens to SFX and Wardrobe files and nothing else. That changes ADR 0030's scope, so it needs a decision record amending it, and the infra and security reviews.
  - Wardrobe's rule (FR4) stands in for checks, as Scenery's does: the app stores no photos of cast members (CLAUDE.md, ADR 0010).
- **Accessibility**: WCAG 2.2 AA, as Scenery: each file has an accessible name saying its name, type and what choosing it does ("Open thunder.mp3, MP3 file"); type icons are decorative to screen readers; upload works by keyboard; progress and errors are announced; targets are at least 24 by 24 CSS pixels; both pages work at 320px and 360px with no sideways scrolling, long names included.
- **Performance**: as Scenery: a page with about 30 files shows them in under 1 second; uploads and downloads go at the speed of the connection; an audio file starts playing as it arrives, without waiting for the whole file.

## Constraints and assumptions

- Builds on production-scenery, which is done: file storage, its per-item, per-department layout (ADR 0030), the Director permission, upload, replace, drag and drop, open and download, delete, notes and the removal clean-up. SFX and Wardrobe are expected to reuse it, not copy it, so that the three pages stay alike. No new AWS resource is needed.
- Builds on production-overview: the SFX and Wardrobe item pages, buttons and count columns already exist.
- Cost stays close to £0 within the existing £5 budget alert. Audio may be larger than scenery files, but the 100 MB cap still applies.
- One production (2027). Deploys stay the maintainer's (CLAUDE.md).
- **Assumption**: SFX is Tech's and Wardrobe is Wardrobe's, each with Director and Admins (production-overview's department assumption, production-scenery FR2).
- **Assumption**: SFX and Wardrobe each have notes and an Overview count, as Scenery does, so that the department pages stay alike.
- **Decided 2026-10-29**: an SFX audio file opens in a new tab in the browser's own player; the audio types are MP3, WAV, M4A, AAC and OGG; Wardrobe has the "no photos of cast members" line and SFX has none; the feature is called Wardrobe, as the show calls it, not Costume.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A fitting photo of a cast member is uploaded to Wardrobe | M | H | The rule on the upload area and in Help, files never public, and anyone who can upload can delete it at once |
| A file becomes reachable without signing in | L | H | Short-lived links, storage that's never public, security and infra reviews, the post-deploy check (`pnpm check:hosted`) |
| A long cue stops or can't be skipped through once its short-lived link expires | M | L | Reopening the file from its row gets a fresh link; the release notes and Help say so if it happens |
| An OGG cue won't play on an older iPhone | M | L | The tab's player says it can't play it; the file can still be downloaded, and Help suggests MP3 |
| Making the Scenery code serve three pages changes Scenery | L | M | Scenery's existing tests stay as they are and must pass unchanged |
| A department's routes reach another department's files | L | M | Tests for each page's routes against the others' files, and with each permission and none |
| Storage costs creep up with audio | L | L | The 100 MB cap, the existing budget alert, files tied to one production |

## Open questions

None open.
