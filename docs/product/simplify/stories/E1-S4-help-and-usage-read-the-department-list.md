---
id: simplify.E1.S4
title: Take Help's access details and Usage's department labels from the list
epic: E1
status: draft
---

## Story

As the maintainer, I want the Help page's access details and the Usage page's department labels to come from the shared list of departments, so that they always match the pages they describe.

## Acceptance criteria

### AC1: Help names who can change each department, as today
Given the Help page
When someone reads which permission changes each department's pages
Then each department lists the same permissions as today, e.g. Scenery: Stage, Tech and Director

### AC2: The Usage page names departments as today
Given "jo" opened the Scenery, SFX, Mic plot and Wardrobe pages for "Opening Number"
When an admin opens the Usage page
Then jo's activity reads "opened a Scenery page", "opened an SFX page", "opened a Mic plot page" and "opened a Wardrobe page"

### AC3: Help and Usage follow a change to the list
Given a department's permissions change in the shared list
When someone opens the Help page
Then Help names the new permissions, with no other change needed

## Notes

- FRs: FR2
- Depends on: simplify.E1.S2
- Out of scope: Props on the Usage page (E2.S3); moving "who can change" into each page's Help (E3.S2).
