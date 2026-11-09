---
id: simplify.E4.S4
title: Take the production from one place in the web app
epic: E4
status: done
---

## Story

As the maintainer, I want the web app to take the production it's showing from one place, so that showing a different production, as Epic 5 needs, means changing that one place.

## Acceptance criteria

### AC1: Every page shows the 2027 production as today
Given the 2027 production's cast, running order, casting, props, files, mics and notes
When someone opens each page
Then each shows the 2027 production's data, as today

### AC2: Every request names the same production
Given the web app set to show production "2028"
When someone opens Cast, Running order, Casting Items, an item's Casting page and the Production overview
Then every request they make is for production 2028

### AC3: No hard-coded production
Given the web app's code
When the maintainer searches it for a production id
Then the production appears in one place only

## Notes

- FRs: FR18
- Depends on: simplify.E4.S2
- AC2 can set the production through a test's set-up; no way to choose one exists until E5.
- AC3 is checked at review.
