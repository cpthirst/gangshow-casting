---
id: production-props.E3.S1
title: Give Production a Stage, Tech and Costume page
epic: E3
status: done
---

## Story

As someone on the production team, I want one page per department under Production, with a switch between that department's lists, so that I can find my department's work in one click without a long menu.

## Acceptance criteria

### AC1: Production has three pages
Given anyone signed in
When they open the menu
Then Production is still in its place, and beneath it are Stage, Tech and Costume, in that order, each a page
And there's no further level of menu, and no Mic plot, Props, Scenery or SFX entries

### AC2: Stage switches between Scenery and Props
Given someone opens Stage
When the page loads
Then it shows a view switch with Scenery then Props, looking and working like the Casting Overview's switch, with Scenery chosen
And choosing Props shows the Props view

### AC3: Tech switches between Mic plot and SFX
Given someone opens Tech
When the page loads
Then it shows a view switch with Mic plot and SFX, with Mic plot chosen

### AC4: Views not built yet say so
Given someone is on Stage or Tech
When they choose Props, Scenery, Mic plot or SFX
Then each view says "Coming soon", until its feature is built

### AC5: Costume is a placeholder
Given someone opens Costume
When the page loads
Then it says "Coming soon", with no view switch

### AC6: Every role can open every page and view
Given "jo" has no permissions
When jo opens Stage, Tech and Costume and every view
Then each opens

### AC7: Old addresses open the right page and view
Given bookmarks to the old Production addresses for Props, Scenery, Mic plot and SFX
When each is opened
Then Scenery and Props open Stage, and Mic plot and SFX open Tech, each on that view

### AC8: The switch is usable by everyone
Given a keyboard or screen reader user on Stage
When they reach the view switch
Then they can move to and choose each view, and the chosen view is announced, as on the Casting Overview

### AC9: Welcome and Help describe the pages
Given someone opens the Welcome page or the Help page
When they read about Production
Then it names Stage, Tech and Costume, the views on each, and that each department's permission is what lets someone change its page

### AC10: Usage records the pages and their views
Given an admin opens the Usage page
When team members have visited Stage and switched to Scenery
Then the visits show under Stage, and the switch as a use of its Scenery view, as Casting Overview's views are recorded

### AC11: The old placeholder pages' usage is purged
Given the Usage page has visits recorded for the old Mic plot, Props, Scenery and SFX pages
When this change is deployed and the purge has run
Then those visits are gone from the Usage page and from the stored usage records
And every other page's usage is unchanged

## Notes

- FRs: FR10, FR11, FR12
- Depends on: production-props.E1.S1, so Help can name the permissions
- The pages reuse the Casting Overview's view switch, and its page layout where they can.
- Mic plot, Props, Scenery and SFX leave the menu, and the Usage page's page names change with them (MenuPageName). The maintainer chose to purge all four pages' visits (2026-10-25).
- The purge touches the real usage records, so it runs as a repository command the maintainer runs after the deploy (like `pnpm account roles`), and is safe to repeat. It deletes only records for those four page names. Ask before running it against the real table.
- The browser layout tests already walk the menu. Ask before adding a walk of the new pages (CLAUDE.md).
- Out of scope: building any of the views. Props arrives in E4.
