---
id: stores.E1.S1
title: Show each store's images on its own page
epic: E1
status: ready
---

## Story

As a Scenery, Props or Wardrobe manager, I want a page for my department's store that shows its images as a gallery whatever show year is chosen, so that what we keep from one show to the next has a home outside any production.

## Acceptance criteria

In each AC, the Scenery store has castle-backdrop.png and throne.jpg, the Props store has none, and the productions are "Gang Show 2026" and "Gang Show 2027".

### AC1: The sidebar has a Stores section
Given anyone signed in
When they open the sidebar
Then it has a **Stores** group, apart from the production's pages, holding **Scenery**, **Props** and **Wardrobe** in that order

### AC2: Each store opens its page
Given anyone signed in
When they choose **Scenery** under Stores
Then the page titled "Scenery stores" opens, and Stores shows it as the current page

### AC3: A store shows its images in the gallery
Given someone opens the Scenery stores page
Then castle-backdrop.png and throne.jpg show as thumbnails in name order, each named beneath

### AC4: Choosing a thumbnail opens the viewer
Given someone is on the Scenery stores page
When they choose throne.jpg's thumbnail
Then the viewer opens on throne.jpg, and moving to the previous image shows castle-backdrop.png

### AC5: An empty store says so
Given someone opens the Props stores page
Then it shows no grid and says the Props store has no images yet

### AC6: A store is the same whichever production is chosen
Given someone is on the Scenery stores page with "Gang Show 2026" chosen
When they switch to "Gang Show 2027"
Then the page still shows castle-backdrop.png and throne.jpg

### AC7: Cutting items doesn't touch the stores
Given "Gang Show 2026"'s running order has "Opening Number"
When a running order without "Opening Number" is saved
Then the Scenery store still has castle-backdrop.png and throne.jpg

### AC8: Deleting a past production doesn't touch the stores
Given "Gang Show 2026" is a past production
When an admin deletes it
Then the Scenery store still has castle-backdrop.png and throne.jpg

### AC9: The stores need a sign-in
Given someone who isn't signed in
When they ask the API for a store's images or their links
Then they're refused, as every route refuses them

### AC10: One request gets a store's links
Given someone opens the Scenery stores page
Then the page asks the API once for the store's images and their links, not once per image

### AC11: A visit is recorded
Given someone opens the Wardrobe stores page
Then the Usage page counts a visit to Wardrobe stores

### AC12: An unknown store is not found
Given someone opens the stores page for a department that has no store, such as SFX
Then the page shows the app's not-found state, and the API answers 404

## Notes

- FRs: FR1, FR2, FR3, FR6, FR8, FR26
- Depends on: none (builds on production-image-gallery, done)
- **Shared piece first.** One shared list of stores names each store and its department, and one store page reads it: the sidebar's three entries, the route, the API's routes and Usage's names all come from that list (FR3). A store added later joins the list only.
- The grid and viewer are the gallery's own (`ImageGrid.vue`, PhotoSwipe, ADR 0042), reused as they are, so AC3 and AC4 check the wiring, not the grid's or viewer's behaviour again. If the grid is tied to an item today, loosen it to take a list of images and links, and move its tests with it.
- The sidebar group is a menu group like the existing ones, built from the routes.
- **ADR first.** Where stores images live, outside every production and item, and where each image's description will be kept (E3.S1), is an ADR (amending ADR 0030 or new) written in this story, before code. It also says why the running-order clean-up and production delete leave stores alone (AC7, AC8). No new AWS resource is expected; if one is needed, stop and ask.
- The private bucket, short-lived links and content security policy are those of item files (ADR 0030), so stores add no new public path.
- Size: likely near or past ~400 lines. If it passes, split the ADR and API listing into a story of their own and update the map.
- Out of scope: adding (E1.S2) and removing (E1.S3) images; descriptions (E3); export (E4); Help (E5.S1).
