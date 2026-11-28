---
id: stores.E1.S2
title: Add an image to a store
epic: E1
status: done
---

## Story

As a Scenery, Props or Wardrobe manager, I want to add a photo to my department's store, so that what we hold is on record for the next show.

## Acceptance criteria

In each AC, the Scenery store has throne.jpg.

### AC1: The store's own department can add an image
Given someone with Stage is on the Scenery stores page
When they add castle-backdrop.png
Then it uploads, its thumbnail joins the grid in name order, named castle-backdrop.png

### AC2: An added image has no description
Given castle-backdrop.png was just added to the Scenery store
When anyone opens it in the viewer
Then it shows its name and no description

### AC3: Each store is changed by its own department
Given someone with Stage, and someone with Wardrobe
When they open the Props stores and the Wardrobe stores pages
Then someone with Stage sees the upload area on Props and not on Wardrobe, and someone with Wardrobe sees it on Wardrobe and not on Props

### AC4: Admins can add to every store
Given an admin
When they open each store's page
Then each shows the upload area

### AC5: Director can't change a store
Given someone with only the Director permission opens the Scenery stores page
Then there is no upload area

### AC6: Tech can't change the Scenery store
Given someone with only Tech opens the Scenery stores page
Then there is no upload area

### AC7: The API refuses anyone else
Given someone with only Director
When they ask the API to add an image to the Scenery store
Then it answers 403 with the Scenery department's refusal, "You can view the scenery, but not change it."

### AC8: Only images the store keeps are taken
Given someone with Stage is on the Scenery stores page
When they add build-list.pdf
Then it isn't uploaded, and the page says build-list.pdf isn't an image the store keeps

### AC9: Images over 100 MB are refused
Given someone with Stage is on the Scenery stores page
When they add a 120 MB castle.jpg
Then it isn't uploaded, and the page says "castle.jpg is over 100 MB, so it wasn't uploaded."

### AC10: The API refuses what isn't an image
Given someone with Stage
When they ask the API to add build-list.pdf to the Scenery store
Then it answers 400 and nothing is stored

### AC11: Every store's upload area shows the safeguarding rule
Given someone who can change each store
When they open the Scenery, Props and Wardrobe stores pages
Then each upload area shows its rule against photos of cast members: "Scenery and set images only: no photos of cast members.", "Props images only: no photos of cast members." and "Costume designs and images only: no photos of cast members."

### AC12: A name already in the store asks first
Given someone with Stage is on the Scenery stores page
When they add another throne.jpg
Then the page asks "Replace throne.jpg? The old copy can't be brought back." before replacing it

## Notes

- FRs: FR4, FR5, FR12, FR14
- Depends on: stores.E1.S1
- Who can change each store is stated once in the shared list of stores, from the departments' permission names, without Director or Tech (FR4, FR5). The API and page both read it.
- The upload area is the shared `FileUpload.vue`, still one file at a time here (E2.S1 makes it many). AC9 and AC12 come from it, so they check the wiring. AC12 is today's replace behaviour, which E2.S2 revisits for batches.
- "Images the store keeps" are those the gallery shows (JPG, PNG, GIF, WebP), judged by name only, as the gallery judges them; the file picker suggests images only.
- AC11 is safeguarding wording, so it is pinned. The rule is said once per store in the shared list.
- Out of scope: many at once (E2); removing (E1.S3); descriptions (E3).
