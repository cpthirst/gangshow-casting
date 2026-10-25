---
id: stage-props.E3.S1
title: Group the Production pages into Stage, Tech and Costume
epic: E3
status: ready
---

## Story

As someone on the production team, I want the Production menu to group its pages by department, so that I can find my department's pages and see whose they are.

## Acceptance criteria

### AC1: Production has three sub-menus
Given anyone signed in
When they open the menu
Then Production is still in its place, and beneath it are Stage, Tech and Costume, in that order
And Stage holds Props and Scenery, Tech holds Mic plot and SFX, and Costume holds one page

### AC2: The pages are still placeholders, open to everyone
Given a Read-Only Team Member
When they open Props, Scenery, Mic plot, SFX or the Costume page
Then each says "Coming soon", as the Production pages do today

### AC3: The current page is marked in its sub-menu
Given someone opens Production → Stage → Scenery
When they look at the menu
Then Scenery is marked as the current page, under Stage

### AC4: Old addresses still work
Given a bookmark to an old Production page address, such as the one for Props
When it's opened
Then the same page opens at its new address

### AC5: Welcome and Help describe the sub-menus
Given someone opens the Welcome page or the Help page
When they read about Production
Then it names Stage, Tech and Costume, what each holds, and that each department's permission is what lets someone change its pages

### AC6: The menu works on a phone
Given a 320px-wide screen
When someone opens the menu and Production's sub-menus
Then every page in them can be reached, with nothing scrolling sideways

## Notes

- FRs: FR10, FR11, FR12
- Depends on: stage-props.E1.S1, so Help can name the permissions
- The menu today has one level of pages under a group, so this adds a second level. The sub-menu names are labels, not pages, as Production is today.
- Pages keep their names as the Usage page records them (MenuPageName), so their usage history carries on.
- The browser layout tests already walk the menu. Ask before adding a walk of the sub-menus (CLAUDE.md).
- Out of scope: building any of these pages. Props arrives in E4.
