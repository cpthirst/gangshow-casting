---
id: stores.E4.S2
title: Keep the catalogue small enough to email
epic: E4
status: ready
---

## Story

As someone exporting a store full of phone photos, I want the catalogue small and quick to make, so that I can email it and open it on any computer.

## Acceptance criteria

### AC1: Images are shrunk to print size
Given the Scenery store has castle-backdrop.jpg, 4000 by 3000 pixels and 8 MB
When anyone exports the store
Then the catalogue's copy of it is no larger than its quarter of an A4 page needs to print well, and the stored image is unchanged

### AC2: A large store stays under 25 MB
Given a store of 200 images of 8 MB each
When anyone exports it
Then the catalogue is under 25 MB

### AC3: The export shows it's working
Given the export of a large store has started
Then the export button shows that it's working and can't be chosen again until it finishes

### AC4: An image that can't be fetched leaves its place
Given the Scenery store has castle-backdrop.jpg, throne.jpg and well.png, and well.png can't be fetched
When anyone exports it
Then the catalogue still has well.png's name and description beside a blank space, and the other two images

### AC5: The page says how many were missed
Given the export from AC4 has finished
Then the page says 1 image couldn't be added to the catalogue

### AC6: A store that can't be read at all says so
Given the store's images can't be listed when the export starts
When anyone exports it
Then nothing downloads, and the page says the catalogue couldn't be made and to try again

## Notes

- FRs: FR23
- Depends on: stores.E4.S1
- Images shrink one at a time in the browser, so a phone or laptop never holds every full-size photo at once. The target is about 150 dpi for a quarter of A4.
- The performance target (200 images in under a minute on a laptop) is checked by hand once, not in the gate; the tests check the size and that images are taken one at a time.
- An image that won't decode (a broken file) counts as missed, as a failed fetch does.
