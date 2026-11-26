---
id: stores.E4.S1
title: Export a store as a Word catalogue
epic: E4
status: ready
---

## Story

As anyone planning a show, I want to download a store as a printed catalogue, four photos to a page with what each is, so that I can take it to a planning meeting or a store visit.

## Acceptance criteria

In each AC, the Props store has six images: barrel.jpg, crown.jpg ("Gold, child's size"), lantern.png, rope.jpg, throne.jpg ("Painted wood, heavy") and wheel.gif.

### AC1: Anyone signed in can export a store
Given someone with only Casting opens the Props stores page
Then it has an export button

### AC2: The export downloads a Word document of the store
When they choose it
Then a Word document named for the store ("Props stores.docx") downloads

### AC3: Four images to an A4 page
Given the catalogue from AC2
Then it has two A4 portrait pages: barrel, crown, lantern and rope on the first in a two-by-two grid, throne and wheel on the second

### AC4: Each image has its name and description
Given the catalogue from AC2
Then crown.jpg's quarter shows the image, "crown.jpg" in bold, and "Gold, child's size" beneath

### AC5: An image with no description shows only its name
Given the catalogue from AC2
Then barrel.jpg's quarter shows the image and "barrel.jpg" in bold, with nothing beneath

### AC6: Each image keeps its shape
Given a tall rope.jpg and a wide wheel.gif
Then each fits its quarter without being stretched or cropped

### AC7: Each page names the show and the store
Given the catalogue from AC2
Then each page's header says "Chester Gang Show: Props stores", and its footer has its page number and the date it was made

### AC8: An empty store offers no export
Given someone opens the Wardrobe stores page, which has no images
Then there is no export button

### AC9: A description prints as text
Given an image described "<b>bold</b>"
Then the catalogue shows the characters "<b>bold</b>", not bold text

## Notes

- FRs: FR20, FR21, FR22, FR24
- Depends on: stores.E3.S2
- Built in the browser, as the other Word exports are (`apps/web/src/utils/word/`), from their shared styles in `word-styles.ts`, and checked with the shared `docx.fixture.ts`. The export button is the one the other exports use.
- Images are fetched through the store's short-lived links. Here they go in at their own size; E4.S2 shrinks them and handles one that can't be fetched.
- Out of scope: shrinking images and missed images (E4.S2).
