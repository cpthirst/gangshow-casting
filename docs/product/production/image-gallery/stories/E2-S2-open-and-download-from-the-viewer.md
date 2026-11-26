---
id: production-image-gallery.E2.S2
title: Open or download an image from the viewer
epic: E2
status: ready
---

## Story

As someone looking at an image in the viewer, I want to open it on its own or download it, so that I can print it, send it on or keep it, as I could from its row before.

## Acceptance criteria

In each AC, the viewer is showing set-plan.jpg, one of "Opening Number"'s Scenery images.

### AC1: Open shows the image alone in a new tab
When someone chooses Open
Then set-plan.jpg opens in a new browser tab, as choosing an image row does (production-scenery FR10)

### AC2: Download saves it under its stored name
When someone chooses Download
Then the browser saves the file as "set-plan.jpg", without opening it

### AC3: Both work however long the viewer has been open
Given the page loaded longer ago than its links last
When someone chooses Open or Download
Then it works, using a link fetched at that moment

### AC4: Every signed-in role may open and download
Given someone signed in as a Read-Only Team Member
When they choose Open, then Download
Then both work

### AC5: An image removed since the page loaded says so
Given someone removed set-plan.jpg in another browser since the page loaded
When someone chooses Open or Download
Then the viewer closes, the page says "set-plan.jpg isn't there any more." and catches up with storage

### AC6: A download that fails says so
Given the link request fails
When someone chooses Download
Then the viewer stays open and says "Couldn't download set-plan.jpg. Try again."

### AC7: Open and Download have names
Given someone using a screen reader is in the viewer
Then they hear the buttons as "Open set-plan.jpg" and "Download set-plan.jpg"

### AC8: The API gives a download link only to someone signed in
Given someone not signed in asks for set-plan.jpg's download link
Then the API refuses
And the download link a signed-in user gets saves the file as an attachment under its stored name, and answers not found for a name not on the item

## Notes

- FRs: FR8 (Open and Download), FR10
- Depends on: production-image-gallery.E2.S1
- Open reuses the existing link and new-tab path (`choose` in `ItemFiles.vue`, `openFileTab`), so AC1 and the open half of AC5 check the wiring.
- **Download needs a link of its own**: an image's link opens it in the browser (`inline`, ADR 0030), and a cross-origin `<a download>` is ignored. The file-link route gains a way to ask for a download, so the link says `attachment` with the stored name. Its type stays from the name alone. Write it as an amendment to ADR 0030's "Opening and downloading", and do the local `/api/local-files/…` path the same way.
- The buttons are added to PhotoSwipe's own toolbar through its UI API, so they sit with Close and the zoom control and share its keyboard handling.
- `security-reviewer` runs (a route change).
- Out of scope: Help (E3.S1).
