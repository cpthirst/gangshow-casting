---
id: casting-overview-timeline.E1.S3
title: Keep each timeline on one line on every phone
epic: E1
status: in-progress
---

## Story

As a member of the production team using a phone at rehearsal, I want each person's timeline to stay on one line however narrow my screen, so that I can scan the cast without the page scrolling sideways.

## Acceptance criteria

### AC1: The demo show fits on a small phone
Given the demo show's 20 items
When I open the Overview on a 320px-wide phone
Then every person's dots sit on one line
And the page doesn't scroll sideways

### AC2: A bigger show wraps at a readable size
Given a show of 30 items
When I open the Overview on a 320px-wide phone
Then no dot is smaller than about 8px
And each half's dots sit on one line, with the halves on separate lines
And the page doesn't scroll sideways

### AC3: Dots keep their size when there's room
Given the demo show's 20 items
When I open the Overview on a desktop screen
Then the dots are their full size, not shrunk

### AC4: The interval gap stays visible when shrunk
Given the demo show's 20 items on a 320px-wide phone, shrunk to fit on one line
When I look at a person's dots
Then the gap at the interval is still visibly wider than the gaps between items

## Notes

- Changed on 2026-10-16 at the user's request, after review: dots stop shrinking at about 8px, and a show too big for one line wraps half by half (AC2, AC4; PRD FR9).
- Browser walks (ADR 0011), all approved by the user: at 320 and 360px with 20 and 30 items, plus one at desktop width for AC3.
- FRs: FR9
- Depends on: casting-overview-timeline.E1.S1.
- Layout can only be checked in a real browser: ask the user whether to add a browser walk (ADR 0011) at 320 and 360px with a ~30-item show.
