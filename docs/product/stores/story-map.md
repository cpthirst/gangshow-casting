---
feature: stores
status: approved
prd: ./prd.md
---

# Stores: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A Stores section in the sidebar, with a gallery page for each of Scenery, Props and Wardrobe that outlasts every production, where each department adds and removes its images | FR1, FR2, FR3, FR4, FR5, FR6, FR8, FR12, FR14, FR19, FR26 |
| E2 | The shared upload takes many images at once, with no prompts, on the stores and the production file pages | FR9, FR10, FR11, FR13 |
| E3 | The pencil edits an image's name and description, and the viewer shows the description | FR7, FR15, FR16, FR17, FR18 |
| E4 | Each store exports a Word catalogue, four images to an A4 page | FR20, FR21, FR22, FR23, FR24 |
| E5 | Help and Welcome describe Stores | FR25 |

## E1: The stores

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [stores.E1.S1](stories/E1-S1-stores-pages.md) | Walking skeleton. The sidebar has a **Stores** section, apart from the production's pages, with **Scenery**, **Props** and **Wardrobe**, each opening the one store page, read from a shared list of stores that names each store's department. The page shows the store's images in the production gallery's grid and viewer, shared rather than copied, from one request for their links, or the files list's empty message when there are none. Stores sit outside every production: the page is the same whichever production is chosen, and no production change (switching, cutting items, deleting a past production) touches them. An ADR (amending ADR 0030 or new) records where stores images and their descriptions live. Opening a store records a visit for Usage | FR1, FR2, FR3, FR6, FR8, FR26 | (none) | done |
| [stores.E1.S2](stories/E1-S2-add-an-image.md) | Someone with the store's own permission (Stage for Scenery and Props, Wardrobe for Wardrobe) or an admin sees the shared upload area on its page, and adds one image, which takes its file's name and no description. Only images the store keeps (JPG, PNG, GIF, WebP, up to 100 MB) are taken. Every store's upload area shows the rule against photos of cast members. Who can change each store is said once and read by the API and the page. The API refuses anyone else, Director included, with the department's refusal, and they see no upload area | FR4, FR5, FR12, FR14 | E1.S1 | ready |
| [stores.E1.S3](stories/E1-S3-remove-an-image.md) | Someone who can change the store sees the trash icon on each thumbnail, which deletes the image and its description with a file's confirm. Nobody else sees it, and the API refuses them | FR4, FR19 | E1.S2 | ready |

## E2: Many at once

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [stores.E2.S1](stories/E2-S1-upload-many.md) | The shared upload takes one image or many, chosen or dropped, with no limit and no prompt during the batch. It sends a few at a time, shows how many have gone and how much of the whole, announces only the start and end, and each image joins the grid as it finishes. The production Scenery, SFX and Wardrobe pages take many too, through the same upload | FR9, FR10, FR13 | E1.S2 | ready |
| [stores.E2.S2](stories/E2-S2-files-that-didnt-upload.md) | When a batch ends, one list says which files didn't upload and why: refused before starting (not an image the page keeps, or over 100 MB), a name already used (kept back, with one step to replace them all), or failed (with one step to try them all again). The list is announced once. The same list shows on the production file pages | FR11, FR13 | E2.S1 | draft |

## E3: Name and description

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [stores.E3.S1](stories/E3-S1-describe-an-image.md) | Someone who can change the store sees a pencil on each thumbnail and in the viewer. It opens a labelled dialog with the image's **Description**, up to 300 characters with the count shown only near the limit. Saving stores it; cancelling doesn't. The viewer shows the description under the image's name. An image deleted elsewhere since the page loaded says so, and the page catches up. The API refuses anyone without the store's permission | FR7, FR15, FR17, FR18 | E1.S3 | ready |
| [stores.E3.S2](stories/E3-S2-rename-an-image.md) | The pencil's dialog also has the image's **Name**. A new name keeps the file's extension and must be unique in the store: one already used is refused with a message saying so, and the dialog stays open. The image keeps its description under its new name, and the grid re-sorts | FR15, FR16, FR18 | E3.S1 | ready |

## E4: The Word catalogue

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [stores.E4.S1](stories/E4-S1-word-catalogue.md) | Each store with images has an export button for anyone who can view it, which downloads a Word catalogue of the whole store, built in the browser with the app's shared Word styles. A4 portrait pages hold up to four images in a two-by-two grid in name order, each keeping its shape within its quarter, with its name in bold and its description beneath. Each page's header names the show and the store, and its footer has the page number and the date made. A store with no images offers no export | FR20, FR21, FR22, FR24 | E3.S2 | ready |
| [stores.E4.S2](stories/E4-S2-catalogue-print-size.md) | The catalogue shrinks each image to print size, one at a time, so 200 phone photos stay under 25 MB and build in under a minute on a laptop, with the button showing that it's working. An image that can't be fetched leaves its name and description beside a blank space, and the page says how many were missed | FR23 | E4.S1 | ready |

## E5: Help

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [stores.E5.S1](stories/E5-S1-help.md) | Help has one entry for the store page: what Stores is for, that it outlasts each show, who can change each store (read from the shared list), that many images go up at once, what the catalogue holds, and not to photograph cast members or name them in descriptions. The production file pages' Help says they take many files. The Welcome page mentions Stores | FR25 | E4.S2 | ready |

## Order

E1.S1 → E1.S2 → E1.S3 → E2.S1 → E2.S2 → E3.S1 → E3.S2 → E4.S1 → E4.S2 → E5.S1

- E1.S1 is the biggest: a new sidebar section, the shared list of stores, API routes for listing and links outside any production, and the ADR. It may pass the ~400-line guideline; if so, the ADR and storage can go first as their own story. Deployed alone, every store shows its empty message.
- E1.S2 adds the first change to a store, so it brings the permission rule and the security review with it.
- E2 changes the production pages' upload too, so its stories rerun those pages' upload tests and the browser layout walks.
- E3 needs only E1, so it can go before E2 if descriptions matter more than batches. E4 follows E3, so the catalogue prints descriptions from its first story.
- E5.S1 goes last, once everything it describes exists. It changes the Help page's code, so it is test-first.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S2, E1.S3 |
| FR5 | E1.S2 |
| FR6 | E1.S1 |
| FR7 | E3.S1 |
| FR8 | E1.S1 |
| FR9 | E2.S1 |
| FR10 | E2.S1 |
| FR11 | E2.S2 |
| FR12 | E1.S2 |
| FR13 | E2.S1, E2.S2 |
| FR14 | E1.S2 |
| FR15 | E3.S1, E3.S2 |
| FR16 | E3.S2 |
| FR17 | E3.S1 |
| FR18 | E3.S1, E3.S2 |
| FR19 | E1.S3 |
| FR20 | E4.S1 |
| FR21 | E4.S1 |
| FR22 | E4.S1 |
| FR23 | E4.S2 |
| FR24 | E4.S1 |
| FR25 | E5.S1 |
| FR26 | E1.S1 |
