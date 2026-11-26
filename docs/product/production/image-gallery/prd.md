---
feature: production-image-gallery
status: approved
owner: Nick Hirst
date: 2026-11-26
---

# Production image gallery: PRD

## Problem

The Scenery, SFX and Wardrobe item pages list every file as a row with a name, size and type icon (production-scenery FR7, production-sfx-wardrobe FR2). A set design, a costume design or a reference photo looks like any other image row, so finding the right one means opening each image in a new tab, closing it and trying the next. At a fitting or a build session, on a phone, that is slow, and it is easy to lose track of which tab is which. Thumbnails were dropped from production-scenery on 2026-10-29 (E2.S3) to keep that feature small. The maintainer is bringing them back as a gallery (ADR 0042).

## Users

| User | Need |
|---|---|
| Stage team (Scenery) | Spot the right set plan or reference photo at a glance, and flick through an item's images during a build |
| Wardrobe team | See an item's costume designs side by side at a fitting, and zoom in on detail |
| Tech team (SFX) | See any images kept with an item's cues, apart from its audio and other files |
| Director | Browse any department's images for an item without opening a tab for each |
| Everyone else signed in (Casting, Read-Only Team Members, Admin) | View and browse images, as they can view files today |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Images are recognisable at a glance | Images a browser can show (JPG, PNG, GIF, WebP) on the Scenery, SFX and Wardrobe pages that show as a thumbnail | All of them |
| Browsing images stays on the page | New tabs opened to look through an item's images | 0 |
| Seeing an image large is quick | Steps from an item's page to seeing one of its images large | 1 (choosing its thumbnail) |
| Works on a phone | Pages with images that scroll sideways at 320px or 360px | 0 |
| The files stay private | Images reachable by anyone who isn't signed in | 0 |
| Nothing else changes | Behaviours of other files (opening, downloading, uploading, deleting, counts) that change in the release | 0 |

## Non-goals

- **Files on the Props page.** Props keeps no files yet. It joins the gallery when it gets them, as a feature of its own.
- **Small previews made and stored beside the files.** The grid shows the images themselves, each loading only as it scrolls into view (decided 2026-11-26). Stored previews are revisited if phones struggle (see Risks). They would amend ADR 0030.
- **A gallery for SVG, HEIC, TIFF, BMP, AVIF** or any image type that doesn't already open in the browser (production-scenery FR10). Those stay in Other Files.
- **Editing images**: cropping, rotating, captions, tags, descriptions or reordering. Images sort by name, as files do.
- **A slideshow** that plays by itself, or full-screen presenting.
- **A gallery across items** or across departments. Each page shows its own item's images.
- **A gallery on the Overview**, counts of images apart from other files, or recording image views on the Usage page.
- **Anything production-scenery left out** (folders, renaming in the app, versions, files for the whole show) stays out.

## Functional requirements

### Where images show
- **FR1**: On each item's Scenery, SFX and Wardrobe page, the files section splits into two when the item has at least one image a browser can show (JPG, PNG, GIF, WebP, as production-scenery FR10 names them):
  - **Images**: first, as a grid of thumbnails;
  - **Other Files**: below it, every other file, as rows exactly as today.
- **FR2**: When an item has no such images, the section is as it is today: a single list of files, with its empty message when there are none. No Images or Other Files heading shows.
- **FR3**: The three pages share one gallery, as they share one files layout (production-sfx-wardrobe FR2). A department that keeps files later, such as Props, gets the gallery by joining the shared list of file departments, with no gallery of its own.

### The grid
- **FR4**: The grid fits as many square thumbnails across as the width allows, from at least two on a 320px phone to more on a wider screen, with no sideways scrolling. Each thumbnail is cropped to fill its square and shows the file's name beneath it, cut short with an ellipsis if it's too long for one line.
- **FR5**: Thumbnails are sorted by name, as files are (production-scenery FR7).
- **FR6**: The grid shows at once, with each thumbnail's name and space, and each image fills in as it loads. An image that fails to load shows the image file icon in its square, and can still be opened.
- **FR7**: Someone who can change the page (production-scenery FR2, production-sfx-wardrobe FR1) sees the trash icon on each thumbnail. It deletes the image with the same confirm and the same result as a file row (production-scenery FR11). Nobody else sees it.

### Seeing an image large
- **FR8**: Choosing a thumbnail opens a viewer over the page that shows the image as large as the screen allows, with its name. From there, anyone can:
  - go to the item's previous or next image, by swiping, by buttons, or with the arrow keys;
  - zoom in and out, by pinching, double-tapping, or with the controls;
  - **open** the image on its own in a new browser tab, as choosing an image row does today (production-scenery FR10);
  - **download** the image, keeping its stored name;
  - close the viewer, by its close button, by Escape, or by swiping down on a phone.
- **FR9**: Closing the viewer returns to the page where it was, with focus on the thumbnail of the image last shown.
- **FR10**: An image deleted since the page loaded says it isn't there any more, as a file row does (production-scenery FR10), and the page catches up with storage.

### Help
- **FR11**: The Help page's entries for the Scenery, SFX and Wardrobe pages say that images show as thumbnails and open in a viewer that swipes between them. The Welcome page needs no change.

## Non-functional requirements

- **Security and safeguarding**:
  - Images are reached only through the short-lived links that files use today (ADR 0030). They are never publicly reachable, and every request needs a sign-in. Opening and downloading from the viewer each get a fresh link, so neither fails because the page has been open a while.
  - Whether a file counts as an image comes from its name alone, as with opening a file in the browser, never from what storage or the uploader says. SVG stays out of the grid.
  - The pages' content security policy widens just enough to show images from file storage, and no further. Every page stays on the app's own scripts and styles, with nothing from a third party at run time (`no-third-party.test.ts`).
  - Images are more prominent in a gallery, so the Scenery and Wardrobe upload rules ("no photos of cast members", ADR 0010) stay where they are, and Help repeats them.
- **Accessibility**: WCAG 2.2 AA:
  - each thumbnail is a control whose accessible name says what choosing it does and the file's name ("View set-plan.jpg");
  - the viewer is a labelled dialog that keeps focus inside it while open, and its buttons are labelled;
  - every action in FR8 works by keyboard as well as touch;
  - targets are at least 24 by 24 CSS pixels;
  - the trash icon on a thumbnail has the accessible name a file row's has ("Remove set-plan.jpg");
  - movement in the viewer respects the setting to reduce motion.
- **Performance**:
  - A page with about 30 files still shows its grid and rows in under 1 second, with images filling in afterwards. Getting the images' links takes one request for the item, not one per image.
  - An image loads only as it comes into view.
  - The viewer's code loads only when someone first opens an image, so pages without images get no heavier.

## Constraints and assumptions

- **ADR 0042** (accepted 2026-11-26): the grid is the app's own, and the viewer is PhotoSwipe 5.
- Builds on production-scenery and production-sfx-wardrobe, which are done: file storage, short-lived links, upload, delete, the removal clean-up and the Overview counts. None of them change. No new AWS resource is needed, only the policy change above.
- Images up to 100 MB load whole into their thumbnails (decided 2026-11-26).
- More than one production: the gallery shows the current production's item, as the file list does, with nothing tied to one year.
- **Decided 2026-11-26**: the viewer has Open and Download buttons (FR8). Props is out of scope; the headings are Images and Other Files, shown only when there is at least one image; the slug is `production-image-gallery`.
- **Assumption**: the gallery sits inside the existing Files section, under its heading, above the upload area's results, and Wardrobe's costumes stay below it.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Large photos make the page slow or costly over phone data | M | M | Images load only as they come into view; stored previews are the follow-up if it bites (an ADR 0030 amendment) |
| A photo of a cast member is uploaded and is now prominent | L | H | The upload rules stay on Scenery and Wardrobe, Help repeats them, anyone who can upload can delete at once, and files are never public |
| A link expires while the viewer is open, and the next image won't load | M | L | Images already seen are cached; the viewer can ask for fresh links, and a failed image says so rather than hanging |
| The policy change opens images from more than file storage | L | M | The infra and security reviews; stack tests on the policy |
| PhotoSwipe stops working with current browsers or Vite | L | M | ADR 0042's runner-up, v-viewer, takes the same grid |
| The viewer doesn't meet the accessibility bar out of the box | M | M | Check labels, focus return and keyboard use in the first story; fill gaps through its options |

## Open questions

None open.
