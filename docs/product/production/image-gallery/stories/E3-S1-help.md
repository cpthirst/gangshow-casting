---
id: production-image-gallery.E3.S1
title: Describe the image gallery in Help
epic: E3
status: done
---

## Story

As a volunteer new to the Scenery, SFX or Wardrobe pages, I want Help to explain the images grid and viewer, so that I know I can swipe through, open and download an item's images.

## Acceptance criteria

### AC1: Each file department's Help describes the images
Given someone opens Help for an item's Scenery, SFX or Wardrobe page
Then it has an entry for **Images**, for everyone, saying they show as thumbnails and open in a viewer that moves between them and zooms
And the same entry describes the viewer's **Open** and **Download**, with their icons

### AC2: Removing covers images
Given someone opens Help for an item's Scenery page
Then its Remove entry still says a removed file can't be brought back, and applies to thumbnails as well as rows

### AC3: The upload rules are still there
Given someone opens Help for an item's Scenery or Wardrobe page
Then its Add a file entry still gives that department's rule about photos of cast members

### AC4: The Welcome page is unchanged
Given someone opens the Welcome page
Then it is as it was before this feature

## Notes

- FRs: FR11
- Depends on: production-image-gallery.E2.S2
- The entries go once in `fileDepartmentHelp` (`apps/web/src/utils/help.ts`), which all three departments' Help reads, so the test checks each department gets them, not three copies.
- Tests check structure (the entries, their names and who they're for), not the wording (CLAUDE.md, "Don't pin content"). AC3's rule is safeguarding wording, already tested where it's set.
- Help is code, so this story is test-first, not a documentation story.
- AC1 amended 2026-11-26: Open and Download share the Images entry rather than having one of their own, which would take each page past Help's 8 entries.
