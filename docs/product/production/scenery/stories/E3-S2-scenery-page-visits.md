---
id: production-scenery.E3.S2
title: Record visits to Scenery pages on the Usage page
epic: E3
status: draft
---

## Story

As an admin, I want the Usage page to count visits to the Scenery pages, so that I can see whether the team uses them.

## Acceptance criteria

### AC1: A visit to a Scenery page is recorded
Given "pat" opens the Scenery page for "Opening Number"
When an admin opens the Usage page
Then it shows a visit to the Scenery page, as it shows visits to the casting item pages

### AC2: Uploads, downloads and deletes aren't recorded
Given "pat" uploads, downloads and deletes a file on a Scenery page
When an admin opens the Usage page
Then it shows only pat's visit to the page

## Notes

- FRs: FR15
- Depends on: production-scenery.E2.S1
- Follow how casting item page visits are recorded and limited (ADR 0023, ADR 0024).
