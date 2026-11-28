---
feature: stores
status: approved
owner: Nick Hirst
date: 2026-11-26
---

# Stores: PRD

## Problem

The Chester Gang Show keeps scenery, props and costumes in stores from one year to the next. Nobody has a shared record of what is in them, so the Scenery, Props and Wardrobe managers rely on memory, a visit to the store, or old phone photos to answer "have we got one of these already?" at a planning meeting. iCUE keeps everything per production (CLAUDE.md, "Each production is self-contained"), so it has nowhere to put things that outlast a show. The production image gallery (production-image-gallery, ADR 0042) already shows images as a grid and a viewer, but only for one item in one production. It has no description for an image, and it takes one file at a time.

## Users

| User | Need |
|---|---|
| Scenery manager (Stage permission) | Photograph the flats, backdrops and set pieces in store, say what each is, and find them again when planning the next show |
| Props manager (Stage permission) | The same for props |
| Wardrobe manager (Wardrobe permission) | The same for costumes, with sizes or condition in the description |
| Director and everyone else signed in | Browse what is in store, and take a printed catalogue to a planning meeting |
| Admin | Change any store, as admins change everything |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Stores outlive each show | Stores images that change when a production is added, switched to, cut down or deleted | 0 |
| Photographing a store is quick | Prompts or stops while uploading a batch of photos | 0 |
| Many photos go up at once | Photos chosen or dropped in one go that upload | All of them, with no limit on how many |
| Each photo says what it is | Steps from a photo to editing its name and description | 1 (its pencil) |
| A catalogue can be printed | Steps from a store to a Word catalogue, 4 photos per A4 page | 1 (the export button) |
| The catalogue can be emailed | Size of a catalogue of 200 phone photos | Under 25 MB |
| Works on a phone | Stores pages that scroll sideways at 320px or 360px | 0 |
| The photos stay private | Stores images reachable by anyone not signed in | 0 |

## Non-goals

- **Files other than images.** Stores keeps only images a browser can show (JPG, PNG, GIF, WebP, as production-image-gallery FR1). There is no Other Files list.
- **Stores for other departments** (SFX, Mic plot, Casting). They join later through the shared list of stores, as a feature of their own.
- **An inventory**: quantities, locations or shelves, condition fields, sizes as fields, tags, categories, or checking items in and out. The description is free text. Search is by name and description only (FR33), within one store.
- **Linking a stores item to a production's item**, or copying a stores photo into an item's files, or the other way round.
- **Editing images**: cropping, rotating, reordering. Images sort by name.
- **Keeping old names or descriptions**: an edit replaces them.
- **Other export formats** (PDF, Excel) or choosing which images go in the catalogue: the catalogue is the whole store.
- **Stores on the Production overview.** Stores have their own overview (FR27).

## Functional requirements

### Where Stores sits
- **FR1**: The sidebar has a **Stores** section, apart from the production's pages, with **Scenery**, **Props** and **Wardrobe** beneath it, each opening that store's page. Everyone signed in sees it.
- **FR2**: Stores belong to the show, not to a production. A store's page is the same whichever production is chosen, and nothing done to a production (adding, switching, saving a running order that cuts items, deleting a past production) changes a store.
- **FR3**: The three stores are one family: one shared list of stores, each naming its department, and one store page they all use. A store added later joins that list, with no page of its own.

### Who can change a store
- **FR4**: Only the department's own permission and admins can change its store: Stage for the Scenery and Props stores, Wardrobe for the Wardrobe store. The Director permission does not change stores. Everyone else signed in can view, open, download and export.
- **FR5**: Who can change each store is said once and read by the API, the store page and Help alike (CLAUDE.md, "Say a thing once"). The API refuses a change from anyone else with the department's refusal (ADR 0035). Someone who can't change a store sees no upload area, pencil or trash icon.

### The gallery
- **FR6**: A store's page shows its images in the production gallery's grid and viewer (production-image-gallery FR4 to FR10), shared rather than copied: square thumbnails sorted by name, each with its name beneath, opening the viewer that swipes, zooms, opens and downloads.
- **FR7**: The viewer also shows the image's description, under its name, when it has one.
- **FR8**: A store with no images shows the empty message the files list uses.

### Uploading one or many
- **FR9**: Someone who can change the store can choose or drop one image or many at once. **Today the shared upload takes one file at a time**, and refuses a drop of more ("Drop one file at a time"), so the shared upload learns to take many. There is no limit on how many in one batch.
- **FR10**: A batch uploads without stopping to ask anything: no prompt for names or descriptions, and no question per file. The upload shows how many of the batch have gone and how much of the whole, and each image joins the grid as it finishes.
- **FR11**: When a batch finishes, the page lists any file that didn't upload and why, in one place:
  - not an image the store keeps (see Non-goals), or over 100 MB, refused before it starts;
  - a name the store already has, kept back rather than replacing the stored image unasked, with a way to replace those files in one step;
  - failed, with a way to try those files again in one step.
- **FR12**: An image uploads with its file's name and no description.
- **FR13**: The production Scenery, SFX and Wardrobe pages share that upload, so they take one file or many too, with the same progress and end-of-batch list (FR10, FR11). Nothing else about their files changes.
- **FR14**: The upload area carries the Scenery and Wardrobe rule against photos of cast members (ADR 0010) on all three stores.

### Name and description
- **FR15**: Someone who can change the store sees a pencil icon on each thumbnail, and in the viewer. It opens a small form with the image's **Name** and a **Description**: a few lines of free text saying what the item is. Saving updates both; cancelling changes neither.
- **FR16**: The name keeps the file's extension and must be unique in the store. A name already in use is refused with a message saying so, and the form stays open.
- **FR17**: The description is at most 300 characters, with the count shown only near the limit, as casting notes do (ADR 0014).
- **FR18**: An image changed or deleted in another browser since the page loaded says so when edited, and the page catches up, as the files list does.

### Deleting
- **FR19**: The trash icon on a thumbnail deletes the image and its description, with the same confirm as a file (production-scenery FR11).

### The Stores overview
- **FR27**: The Stores section opens with an **Overview** listing every store in the shared list (FR3), each with how many images it holds and a link to its page. It is the same in every production, and records a visit for Usage.
- **FR28**: What Stores is for, and that it outlasts every production year, is said in Help and on the Welcome page (FR25), not on the overview (CLAUDE.md, "Let the layout explain itself").

### Destroyed items
- **FR29**: Someone who can change a store (FR4) can mark an image **destroyed** with a Destroy button, with its own icon, on its thumbnail and in the viewer. A labelled dialog asks for the **Date destroyed** (today by default) and a **Reason** (required, up to 300 characters, the count shown only near the limit). The image stays in file storage; nothing is deleted.
- **FR30**: A destroyed image shows greyed out, after the images still in store, in name order. It can still be opened, viewed, downloaded, edited and deleted. The overview's counts (FR27) cover only images still in store.
- **FR31**: The viewer shows an info button beside download on a destroyed image, for anyone signed in, giving the date, the reason and the username of who recorded it (ADR 0018).
- **FR32**: Someone who can change the store can **Restore** a destroyed image from its info, after a confirm, which clears its date and reason. The API refuses destroy and restore from anyone else with the department's refusal (ADR 0035).

### Search
- **FR33**: A store with images has a search above its grid, following the Cast page's filters: it matches the image's name or description, ignoring case, with a live count ("1 of 4 images") and a Clear button, and destroyed images can be found and opened. The viewer moves only through the matches.

### The Word catalogue
- **FR20**: Each store's page has an export button that downloads a Word document of the whole store, for anyone who can view it. It joins the app's other Word exports and their shared styles.
- **FR21**: The catalogue's pages are A4 portrait, each holding up to four images in a two-by-two grid, in name order. Each image keeps its shape, scaled down to fit its quarter, with its name in bold and its description beneath. An image with no description shows only its name.
- **FR22**: Each page's header names the show and the store ("Chester Gang Show: Wardrobe stores"), and its footer has the page number and the date the catalogue was made.
- **FR23**: Images are shrunk to print size in the document, so a 200-image catalogue stays under 25 MB. An image that can't be fetched leaves its name and description with a blank space, and the page says how many were missed when the download finishes.
- **FR24**: A store with no images offers no export.
- **FR34**: Destroyed images close the catalogue, after the rest and starting a new page, each marked with its date destroyed and reason.

### Help, Welcome and Usage
- **FR25**: Help has one entry for the store page, saying what Stores is for, that it outlasts each show, who can change each store (from FR5), that many images can go up at once, how destroying and search work, and what the catalogue holds, and one for the Stores overview. The Welcome page mentions Stores.
- **FR26**: Opening a store's page records a visit for the Usage page, named by its store, as the other pages do (ADR 0023, ADR 0024).

## Non-functional requirements

- **Security and safeguarding**:
  - Stores images are private, as item files are (ADR 0030): never publicly reachable, reached only through short-lived links, and every request needs a sign-in.
  - Whether a file is an image comes from its name alone, as in the gallery; SVG stays out.
  - Stores hold items, not people. The no-photos-of-cast-members rule shows on every store's upload area, and Help repeats it. Descriptions and destroy reasons are about the item; Help says not to name cast members in them.
  - Names and descriptions are shown as text, never as HTML, on the page and in the catalogue.
  - The API checks FR4's permission on every change, whatever the page shows.
- **Accessibility**: WCAG 2.2 AA, with everything production-image-gallery requires of the grid and viewer, plus:
  - the pencil has an accessible name with the image's name ("Edit set-plan.jpg");
  - the edit form is a labelled dialog, its fields labelled, focus returning to the pencil when it closes;
  - the upload's progress is announced at the start and end of a batch, and the list of files that didn't upload is announced once, never per file;
  - a keyboard can choose many files, upload, edit, delete and export.
- **Performance**:
  - A store of 300 images shows its grid in under 1 second, with images filling in as they scroll into view, from one request for the store's links.
  - A batch of 50 phone photos uploads without the page freezing, a few at a time rather than all at once.
  - A 200-image catalogue builds in under 1 minute on a laptop, showing that it's working meanwhile.

## Constraints and assumptions

- **Builds on production-image-gallery** (done, ADR 0042) and production-scenery's file storage (ADR 0030). The grid, viewer, short-lived links and Word styles are reused, not copied.
- **Stores live outside every production.** Today every stored file sits under a production and an item (ADR 0030), and the removal clean-up and production delete work from that. Keeping stores apart from both, and storing a description beside each image, are decisions for an ADR (an amendment to ADR 0030, or a new one) in the first story. No new AWS resource is assumed.
- **Renaming is new.** Item files can't be renamed in the app today; renaming a stores image is.
- **The Word catalogue is built in the browser**, as the app's other Word exports are.
- **Decided 2026-11-26**: Director doesn't change stores, and Tech doesn't change the Scenery store (unlike production Scenery); the production file pages take many files too; no limit on a batch; descriptions up to 300 characters; the catalogue shrinks images and prints each one's name and description; Stores pages record visits and appear on the Welcome page.
- **Decided 2026-11-28**: Stores has an overview with counts, its explanation in Help and Welcome rather than on the page; destroying keeps the photo, asks for a date and reason, and can be restored; search is per store, by name and description, and finds destroyed images; destroyed images close the catalogue, marked.
- **Assumption**: "Costume managers" are the Wardrobe permission (ADR 0027).
- **More than one production**: nothing in Stores reads the chosen production.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A photo of a cast member is uploaded to a store and kept for years | M | H | The rule on every upload area and in Help, anyone who can upload can delete, never public; Stores outliving shows makes this worth a check in the security review |
| iPhone photos arrive as HEIC, which the store won't keep | M | M | Most phones send JPEG through the browser's picker; the end-of-batch list says why a file was refused |
| A catalogue of hundreds of large photos is slow to build or runs out of memory on a phone | M | M | Shrink images one at a time while building; the performance target is on a laptop, and the button works on a phone for small stores |
| Multi-upload changes how the production pages upload | M | M | Decided (FR13); the shared upload's own tests cover one file and many, and each page keeps one check that it's wired up |
| Stores grow without limit, and storage costs creep | L | L | Phone photos at 100 MB each cap is generous; revisit with the budget alert (remote-data FR13) |

## Open questions

None open.
