---
id: stores.E4.S3
title: End the catalogue with what's been destroyed
epic: E4
status: ready
---

## Story

As anyone planning a show, I want the printed catalogue to end with the items that have been destroyed, marked as such with when and why, so that a planning meeting knows not to count on them but can see them if a rebuild comes up.

## Acceptance criteria

In each AC, the Props store has barrel.jpg, crown.jpg, lantern.png, rope.jpg and throne.jpg, of which crown.jpg and throne.jpg are destroyed. throne.jpg was destroyed on 3 November 2026 for "Leg snapped at the 2026 get-out".

### AC1: Destroyed images come after the rest
When anyone exports the Props catalogue
Then barrel, lantern and rope come first, and crown and throne follow in name order on a new page

### AC2: Each is marked destroyed, with when and why
Given the catalogue from AC1
Then throne.jpg's quarter shows its image, "throne.jpg" in bold, "Destroyed 3 November 2026", and "Leg snapped at the 2026 get-out", then its description if it has one

### AC3: A store with nothing destroyed is unchanged
Given nothing in the Props store is destroyed
When they export it
Then the catalogue is as E4.S1 describes, with no destroyed pages

### AC4: A store with only destroyed images still exports
Given every Props image is destroyed
When they export it
Then the catalogue holds them all, each marked destroyed

## Notes

- FRs: FR34
- Depends on: stores.E4.S1, stores.E3.S3
- Destroyed images keep the four-to-a-page layout, but start a new page so the two kinds never share one.
- E4.S2's shrinking and missed-image count cover destroyed images too.
- Decided by Nick Hirst, 2026-11-28: destroyed images go at the end, marked.
