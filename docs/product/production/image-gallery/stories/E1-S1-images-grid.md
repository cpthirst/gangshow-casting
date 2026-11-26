---
id: production-image-gallery.E1.S1
title: Show an item's images as a thumbnail grid
epic: E1
status: done
---

## Story

As someone on the Stage, Tech or Wardrobe team, I want an item's images shown as thumbnails above its other files, so that I can spot the right set plan, costume design or reference photo at a glance instead of opening each one.

## Acceptance criteria

In each AC, unless it says otherwise, "Opening Number" has these Scenery files: backdrop.png, build-list.pdf and set-plan.jpg.

### AC1: Images and other files are split
Given someone signed in opens Opening Number's Scenery page
Then the Files section shows an **Images** heading with a thumbnail of backdrop.png and then one of set-plan.jpg
And below it an **Other Files** heading with build-list.pdf's row, as rows show today

### AC2: Only images the browser can show are thumbnails
Given Opening Number also has logo.svg, fitting.heic and poster.webp
When someone opens its Scenery page
Then poster.webp has a thumbnail
And logo.svg and fitting.heic are rows under Other Files, with the image file icon

### AC3: An item with no images looks as it does today
Given "Finale" has only cue-sheet.pdf and notes.txt
When someone opens its Scenery page
Then the Files section lists both as rows, with no Images or Other Files heading

### AC4: An item with only images has no Other Files heading
Given "Interval Act" has only backdrop.png
When someone opens its Scenery page
Then it shows the Images heading and backdrop.png's thumbnail, and no Other Files heading

### AC5: Each thumbnail is named beneath it
Given Opening Number has an image named "act-one-forest-backdrop-final-version-2.jpg"
When someone views it at 320px wide
Then its thumbnail shows the name beneath it on one line, cut short with an ellipsis
And the thumbnail's accessible name is "Open act-one-forest-backdrop-final-version-2.jpg, JPG file", as its row's would be

### AC6: The grid fits the width
Given Opening Number has six images
When someone views its Scenery page at 320px wide
Then the thumbnails are square, at least two across, and the page doesn't scroll sideways
And at 1024px wide more fit across

### AC7: Choosing a thumbnail opens the image in a new tab
Given someone is on Opening Number's Scenery page
When they choose set-plan.jpg's thumbnail
Then set-plan.jpg opens in a new browser tab, as choosing its row did before

### AC8: The page asks for every image's link in one request
Given Opening Number has 12 images
When someone opens its Scenery page
Then the page makes one request for the images' links, not one per image

### AC9: An image loads only as it scrolls into view
Given Opening Number has 30 images
When someone opens its Scenery page on a phone
Then an image further down the grid isn't fetched until it scrolls near the screen

### AC10: An image that won't load shows the image icon
Given set-plan.jpg's file is damaged and won't display
When someone opens Opening Number's Scenery page
Then set-plan.jpg's thumbnail shows the image file icon in its square, with its name beneath
And choosing it still opens it in a new tab

### AC11: Thumbnails still load after the page has been open a while
Given someone opened Opening Number's Scenery page longer ago than the images' links last
When a thumbnail they haven't seen yet scrolls into view
Then it loads, the page having asked again for the links

### AC12: The SFX and Wardrobe pages have the same grid
Given Opening Number has storm.jpg among its SFX files and dress-design.png among its Wardrobe files
When someone opens its SFX page, then its Wardrobe page
Then each shows the Images heading with that thumbnail, and its other files under Other Files

### AC13: Image links need a sign-in and stay with the item
Given someone not signed in asks the API for Opening Number's image links
Then the API refuses them
And a signed-in Read-Only Team Member gets links for backdrop.png and set-plan.jpg only, not build-list.pdf
And an item not in the latest saved running order answers not found

### AC14: The pages let images come from file storage, and nowhere else
Given the deployed pages' content security policy
Then it allows images from the app's own address and from the files bucket
And from no other address

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5, FR6
- Depends on: none
- **Shared piece**: the grid goes in `ItemFiles.vue`, the files layout all three pages share, or in a component it uses, so AC12 is a check that each page is wired up, not a second full test. Which files are images comes from one rule beside `opensInBrowser` (the JPG, PNG, GIF and WebP types `browserTypeOf` already names), read by the grid and by the API.
- **Links in one request** (AC8, AC13): either the list route carries a link for each image, or each department gains one `…/<dept>-image-links` route. Whichever is simpler, the links last 5 minutes and aren't cached, as one file's link (`cache-control: no-store`), and it joins `routes.ts` and the API spec for all three departments at once. ADR 0042 already records this. Getting links again (AC11) reuses the same request, once per lapse, and not once per image.
- **Lazy loading** (AC9) is the browser's own `loading="lazy"`; the test checks the attribute, not the network.
- **The policy** (AC14) is `img-src` in `infra/lib/pages.ts`, which gains the files bucket's address as `connect-src` already has. A stack test checks it. Locally the images come from `/api/local-files/…`, the app's own address.
- **Phone widths** (AC6): ask the user, when implementing, whether to add the grid to the browser layout walk (CLAUDE.md, ADR 0011). If not, check it by hand at 320px and 360px with `screenshot-checker`.
- Reviewers: `security-reviewer` (API and links) and `infra-reviewer` (the policy) both run.
- Out of scope: the trash icon on thumbnails (E1.S2), the viewer (E2.S1), Open and Download (E2.S2), Help (E3.S1).
