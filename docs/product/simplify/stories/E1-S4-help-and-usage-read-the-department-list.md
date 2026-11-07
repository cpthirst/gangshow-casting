---
id: simplify.E1.S4
title: Take Help's access details and Usage's department labels from the list
epic: E1
status: done
---

## Story

As the maintainer, I want the Help page's access details and the Usage page's department labels to come from the shared list of departments, so that they always match the pages they describe.

## Acceptance criteria

### AC1: Help names who can change each department, as today
Given the Help page
When someone reads who can change each department's pages
Then each line names the same permissions as today, e.g. "Accounts with Stage, Tech or Director, and admins" for Scenery, "Accounts with Stage or Director, and admins" for Props and "Accounts with Casting, and admins" for Casting

### AC2: The Usage page names departments as today
Given "jo" opened the Scenery, SFX, Mic plot and Wardrobe pages of an item no longer in the running order
When an admin opens the Usage page
Then jo's activity reads "opened a Scenery page …", "opened an SFX page …", "opened a Mic plot page …" and "opened a Wardrobe page …"
And the totals are headed "Scenery pages", "SFX pages", "Mic plot pages" and "Wardrobe pages"

### AC3: Help follows a change to a department's permissions
Given the shared list says Props may be changed by Tech or Director
When someone reads Help's lines for the Props page
Then they say "Accounts with Tech or Director, and admins", with no other change needed

### AC4: Usage follows a change to a department's name
Given the shared list names the Mic plot department "Radio mics"
When an admin reads the Usage page's activity and totals
Then a visit reads "opened a Radio mics page …" and its total is headed "Radio mics pages", with no other change needed

## Notes

- FRs: FR2
- Depends on: simplify.E1.S2 (done), simplify.E1.S3 (done)
- AC1 and AC2 restate today's behaviour; the Help and Usage pages' existing tests cover them and must stay green through the change, so they have no red step of their own.
- Assumptions (made while the maintainer was away):
  - Help's "who can use it" labels are keyed by department ("props", "sfx", "mic-plot", …) instead of by permission ("stage", "tech"), plus "everyone" and "admins". A department's label is built from its permissions in the order the Accounts page lists them, joined with "or": "Accounts with Stage, Tech or Director, and admins". The Running order's and Cast's casting-only lines use the Casting department.
  - The article before a department's name ("a Scenery page", "an SFX page") joins the shared list beside "it"/"them", since it can't be worked out from the spelling ("an SFX").
  - AC3 and AC4 are tested by giving the Help and Usage wording a changed list in a unit test, not by changing the real list.
- Also tidied: `departments.props` in place of `departments["props"]` on the Props page; an unused helper in the Wardrobe page's tests.
- Out of scope: Props on the Usage page (E2.S3); moving "who can change" into each page's Help (E3.S2).
