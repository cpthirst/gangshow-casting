---
id: simplify.E3.S2
title: Show a View only badge, with who can change the page in its Help
epic: E3
status: done
---

## Story

As a viewer, such as the director reviewing casting, I want a small "View only" badge instead of a sentence on every page, so that I can see I can't change it without the page's data being pushed down, and still find who can in Help.

## Acceptance criteria

### AC1: A view-only page shows the badge
Given "pat" has no permissions
When pat opens the Cast page
Then a "View only" badge shows beside the title
And the sentence "You can view the casting, but not change it: only Casting and admins can." no longer shows

### AC2: Every view-only page shows it
Given "pat" has no permissions
When pat opens Cast, the Casting overview, Casting Items, Running order, and the Casting, Props, Scenery, SFX, Mic plot and Wardrobe item pages
Then each shows the "View only" badge beside its title

### AC3: Pages the person can change show no badge
Given "sam" has Tech
When sam opens the SFX page for "Opening Number"
Then no "View only" badge shows
And sam can still change its files and notes

### AC4: A screen reader hears it
Given "pat" has no permissions
When pat reaches the Props page's title with a screen reader
Then the badge is read out as "View only", not conveyed by colour alone

### AC5: Help says who can change the page
Given someone on the Scenery page for "Opening Number"
When they open its Help
Then it says "Only Stage, Tech, Director and admins can change the scenery."
And the Props page's Help says "Only Stage, Director and admins can change the props.", each from the shared list of departments

### AC6: A refused change still shows its alert
Given "pat" had the Props page open before losing Stage
When pat saves a prop and the API refuses it
Then the page shows "You can view the props but not change them, so this wasn't saved." as an alert, as today

### AC7: It fits a phone
Given the item pages with a long-titled item, at 320px and 360px wide
When a viewer with no permissions opens them
Then the title, Help button and badge fit without the page scrolling sideways

## Notes

- FRs: FR10, FR13
- Depends on: simplify.E1.S4, simplify.E2.S4
- Team-roles FR6 asks for "a short visible line, such as 'You have read-only access'". The badge is visible text, not a tooltip, so it meets FR6 (PRD FR10).
- The existing browser layout walks cover the item pages. Ask the maintainer before adding a walk for a viewer with no permissions (CLAUDE.md).
- Out of scope: the "Only admins can …" lines on Cast and Running order (E3.S4).
- Assumptions (made while the maintainer was away):
  - The badge is plain text in the page's title row, after the title and before Help, so a screen reader reads "View only" straight after the heading. It isn't part of the `<h1>`, so the page's title stays the title.
  - One shared title row (title, badge, Help button) replaces the six copies on Cast, Casting overview, Casting Items, Running order, Production overview and the item frame. Which department a page belongs to is said once, in its Help entry, and the badge reads it from there; the Production overview has none, so it never shows the badge.
  - Help's "who can change" line comes after the page's summary, on the Help page as well as behind each page's Help button. The Running order and every casting page name the Casting department, as today's sentence does: "Only Casting and admins can change the casting."
  - After a refusal (AC6) the page shows both the alert and the badge, since the person is now view only.
  - AC7 needs a layout walk as a viewer with no permissions, which the existing walks (all as an admin) don't do. Adding one needs the maintainer's yes, so until then AC7 rests on the title row wrapping and the badge never breaking mid-word.
