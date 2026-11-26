---
id: production-image-gallery.E2.S1
title: View an item's images large and swipe between them
epic: E2
status: ready
---

## Story

As someone at a fitting or a build session, I want to open an image large and swipe through the item's others, so that I can look closely without opening and closing a tab for each one.

## Acceptance criteria

In each AC, "Opening Number"'s Scenery images are backdrop.png, set-plan.jpg and wings.webp, and it has build-list.pdf too.

### AC1: Choosing a thumbnail opens it in the viewer
Given someone signed in is on Opening Number's Scenery page
When they choose set-plan.jpg's thumbnail
Then the viewer opens over the page, showing set-plan.jpg as large as the screen allows, with its name
And no new tab opens

### AC2: A thumbnail says it opens the viewer
Given someone using a screen reader is on Opening Number's Scenery page
Then set-plan.jpg's thumbnail is announced as "View set-plan.jpg"

### AC3: Next and previous move through the item's images
Given the viewer is showing set-plan.jpg
When they choose Next, press the right arrow key, or swipe left
Then it shows wings.webp
And Previous, the left arrow key or a swipe right shows backdrop.png
And the viewer never shows build-list.pdf

### AC4: The images go round
Given the viewer is showing wings.webp, the last image
When they choose Next
Then it shows backdrop.png

### AC5: One image has no next or previous
Given "Interval Act" has only backdrop.png
When someone opens it in the viewer
Then there are no Next or Previous buttons

### AC6: Zooming in and out
Given the viewer is showing set-plan.jpg
When they pinch, double-tap, or choose the zoom control
Then the image zooms in, and the same again zooms back out

### AC7: Closing returns to the thumbnail last shown
Given someone opened set-plan.jpg and moved on to wings.webp
When they press Escape, choose Close, or swipe down on a phone
Then the viewer closes, the page is where it was, and focus is on wings.webp's thumbnail

### AC8: The viewer is a labelled dialog
Given the viewer is open
Then screen readers hear it as a dialog, and its Close, Next, Previous and zoom buttons each have a name
And keyboard focus stays inside it until it closes

### AC9: The viewer follows the setting to reduce motion
Given someone's device is set to reduce motion
When they open, move through or close the viewer
Then it changes without animating

### AC10: The viewer's code loads only when needed
Given someone opens an item's Scenery page
Then the viewer's code isn't loaded until they first choose a thumbnail

## Notes

- FRs: FR8 (all but Open and Download), FR9
- Depends on: production-image-gallery.E1.S1
- The viewer is PhotoSwipe 5 (ADR 0042): `photoswipe/lightbox`, with its core imported only on first open (AC10) and its CSS imported through Vite, never added at run time (`style-src 'self'`). S3 gives no image sizes, so each is read from its loaded thumbnail (the snippet in ADR 0042). A thumbnail that failed to load (E1.S1 AC10) is measured once its full image arrives, or opened in a new tab as before.
- happy-dom can't swipe, pinch or animate, so, as with Chart.js (ADR 0039), the tests check what the page hands PhotoSwipe: the item's images in name order and nothing else (AC3, AC5), `loop` on (AC4), its labels (AC8), no animation when reduce motion is set (AC9), focus returned to the last-shown thumbnail on close (AC7), and the module loaded lazily (AC10). Swiping, pinching and Escape are PhotoSwipe's own. Check them by hand on a phone before the PR.
- One viewer serves all three pages, inside the shared files layout, so it is tested once there.
- New runtime dependency: `security-reviewer` runs.
- Out of scope: Open and Download (E2.S2), Help (E3.S1).
