---
id: production-mics.E3.S3
title: Describe the Mic plot on the Welcome and Help pages
epic: E3
status: ready
---

## Story

As a volunteer new to the Mic plot, I want the Welcome and Help pages to explain it, so that I know how to give out mics and why some channels are greyed out.

## Acceptance criteria

### AC1: Help describes the Mic plot page
Given anyone signed in
When they open the Help page
Then it describes the Mic plot page: the 24 channels, choosing a cast member in the item and their role, a blank role for someone without a named part, and Mic plot notes

### AC2: Help explains the greyed-out channels
When anyone opens the Help page
Then it says a channel used by someone else in the item before is greyed out ("Used in previous item"), that the same person can keep it, that it resets at the interval, and that an allocation a reorder makes impossible stays, flagged as an Error, until it's cleared

### AC3: Help says who can change it
When anyone opens the Help page
Then it says Tech, Director and Admins can change the Mic plot, and everyone else can view it

### AC4: Help describes Generate Mic Plot
When anyone opens the Help page
Then it describes Generate Mic Plot on the Overview, and says the workbook holds under-18s' names and is for the production team only

### AC5: Welcome mentions the Mic plot
When anyone opens the Welcome page
Then it mentions the Mic plot page alongside the other Production department pages, and no longer calls it "Coming soon"

## Notes

- FRs: FR15
- Depends on: production-mics.E2.S1, production-mics.E3.S2 (and everything else it describes)
- Changes the Help and Welcome pages' code, so it is test-first, as production-sfx-wardrobe.E2.S2 was.
- production-mics.E1.S3 already gave the Mic plot item page its "Item help" button and a Help topic (All items, Previous and Next, Mic 1 to Mic 24, Clear, Mic plot notes, Tech changes it), and took "Coming soon" out of Help. This story extends that topic; Welcome still says "Coming soon" (AC5).
