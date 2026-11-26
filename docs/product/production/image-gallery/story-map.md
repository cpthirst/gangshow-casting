---
feature: production-image-gallery
status: approved
prd: ./prd.md
---

# Production image gallery: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | The Scenery, SFX and Wardrobe pages show an item's images as a thumbnail grid headed Images, above its Other Files | FR1, FR2, FR3, FR4, FR5, FR6, FR7 |
| E2 | Choosing a thumbnail opens a viewer that swipes, zooms, opens and downloads | FR8, FR9, FR10 |
| E3 | Help describes it | FR11 |

## E1: The grid

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-image-gallery.E1.S1](stories/E1-S1-images-grid.md) | Walking skeleton. When an item has a JPG, PNG, GIF or WebP, its Scenery, SFX or Wardrobe page heads the images **Images**, in a grid of square, cropped thumbnails, at least two across at 320px, each named beneath and sorted by name, with every other file below under **Other Files**. An item with no images looks as it does today. The page gets every image's link in one request. Each image loads as it scrolls into view, and one that fails shows the image icon. The pages' content security policy lets images come from file storage, and from nowhere else. All three pages share one grid, which reads the shared list of file departments. Choosing a thumbnail still opens it in a new tab, as a row does | FR1, FR2, FR3, FR4, FR5, FR6 | (none) | done |
| [production-image-gallery.E1.S2](stories/E1-S2-remove-an-image.md) | Someone who can change the page sees a trash icon on each thumbnail, with a file row's confirm, accessible name and result. When the last image goes, the page returns to its single Files list. Nobody else sees the icon | FR7 | E1.S1 | done |

## E2: The viewer

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-image-gallery.E2.S1](stories/E2-S1-view-an-image-large.md) | Choosing a thumbnail opens the viewer (PhotoSwipe 5, ADR 0042) over the page: the image as large as the screen allows, with its name. You move to the item's previous or next image by swipe, button or arrow key, and zoom by pinch, double-tap or the controls. Escape, the close button or a swipe down closes it, and focus returns to the thumbnail of the image last shown. It is a labelled dialog, it follows the setting to reduce motion, and its code loads only on the first open | FR8, FR9 | E1.S1 | done |
| [production-image-gallery.E2.S2](stories/E2-S2-open-and-download-from-the-viewer.md) | The viewer gains **Open**, which shows the image alone in a new tab, and **Download**, which saves it under its stored name. Each gets a fresh link, so they work however long the page has been open. An image deleted since the page loaded says it isn't there any more, and the page catches up with storage. A download link for an image that otherwise opens in the browser amends ADR 0030 | FR8, FR10 | E2.S1 | done |

## E3: Help

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-image-gallery.E3.S1](stories/E3-S1-help.md) | Help's entries for the Scenery, SFX and Wardrobe pages say that images show as thumbnails and open in a viewer that swipes between them, opens and downloads, and they repeat the upload rules. The Welcome page is unchanged | FR11 | E2.S2 | done |

## Order

E1.S1 → E1.S2 → E2.S1 → E2.S2 → E3.S1

- E1.S1 is the biggest. It changes the API's list (or adds one route for the images' links), the pages' policy in `infra`, and the shared files layout. It stays whole, because a grid without links or without the policy shows nothing once deployed. It may pass the ~400-line guideline. If it does, the policy change can go first as a story of its own.
- E1.S2 needs only E1.S1. It can go after E2.S1 if the viewer matters more.
- E2.S1 adds the `photoswipe` dependency, so it needs the security review.
- E3.S1 goes last, once everything it describes exists. It changes the Help page's code, so it is test-first.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1, E1.S2 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S1 |
| FR6 | E1.S1 |
| FR7 | E1.S2 |
| FR8 | E2.S1, E2.S2 |
| FR9 | E2.S1 |
| FR10 | E2.S2 |
| FR11 | E3.S1 |
