---
id: production-scenery.E3.S1
title: Describe Scenery and Director on the Welcome and Help pages
epic: E3
status: done
---

## Story

As a volunteer new to the app, I want the Welcome and Help pages to explain the Scenery page and the Director permission, so that I know where an item's set plans are, how to add one, and what a Director can change.

## Acceptance criteria

### AC1: Welcome describes the Scenery page
Given someone opens the Welcome page
When they read about Production
Then it says each item's Scenery page holds its set plans, designs and photos, for everyone to download

### AC2: Help describes uploading, replacing, downloading and removing
Given someone opens the Help page
When they read about the Scenery page
Then it says how to upload a file (one at a time, up to 100 MB), that a file with the same name replaces the old one, how to download a file, and how to remove one with its Remove button
And that replacing and removing can't be undone

### AC3: Help states the images rule
Given someone reads the Scenery page's help
When they read about uploading
Then it says "Scenery and set images only: no photos of cast members."

### AC4: Help says who can change scenery
Given someone reads the Scenery page's help
When they read who can change it
Then it says Stage, Tech, Directors and admins can upload and remove files, and everyone else can view and download them

### AC5: Help describes Director
Given someone opens the Help page
When they read its Permissions section, which has a line for each permission (Casting, Stage, Tech, Wardrobe, Director) and for admins
Then the Director line says it changes every production department's pages, but not the cast, roles, casting or running order, and nothing admin-only

### AC6: The Scenery page's help button opens its help
Given someone on a Scenery page
When they choose the page's help button
Then it shows the Scenery page's help

### AC7: The Overview's help names who changes Scenery
Given someone reads the Overview's help
When they read who can change each department's pages
Then it says Stage and Tech change Scenery, and Directors change every department

## Notes

- FRs: FR14
- Depends on: production-scenery.E1.S2, E2.S5, and every E2 story it describes
- Documentation in the app, but it changes app code (the Help and Welcome pages), so it's built test-first.
- The Help page had no description of permissions, so AC5 adds a short Permissions section at its end (agreed 2026-10-29).
- The Scenery page labels deleting "Remove", so the help does too.
- Plain words for non-technical volunteers. Name things as the pages label them.
