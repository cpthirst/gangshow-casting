---
id: production-overview.E2.S1
title: Give Production one Overview, starting with Props
epic: E2
status: done
---

## Story

As someone on the production team, I want one Overview of the show under Production, with a Props button on each item, so that I find an item once and open its props without switching pages or views.

## Acceptance criteria

### AC1: Production has one page
Given anyone signed in
When they open the menu
Then Production is still in its place, with a single page, Overview, beneath it
And there are no Stage, Tech or Wardrobe entries

### AC2: The Overview lists the running order by half
Given a saved running order with "Opening Number" as item 1 in the first half, and "Interval Music" not in the printed programme
When someone opens the Overview
Then the items are listed in running order under each half
And each row shows its number and title, with no minutes column
And "Interval Music" has no number and is marked "Not in printed programme"

### AC3: Each row shows its props count
Given "Opening Number" has 3 props and "Campfire Sketch" has none
When someone opens the Overview
Then a column headed Props shows 3 for Opening Number and 0 for Campfire Sketch, each with a text label for screen readers
And if the props can't be loaded, the items still show, without counts

### AC4: There's no view switch
Given someone opens the Overview
When the page loads
Then there are no Scenery, Props, Mic plot or SFX view switches (pills)

### AC5: Someone with Stage gets an edit button
Given "pat" has Stage
When pat opens the Overview
Then each row has a square Props button with a props icon, named for example "Edit props for Opening Number"
And choosing it opens that item's props page, where pat can change props

### AC6: Someone without Stage gets a view button
Given "jo" has no permissions
When jo opens the Overview
Then each row's square Props button is named for example "View props for Opening Number"
And choosing it opens that item's props page read-only, saying what can be viewed but not changed

### AC7: Props notes show under their item
Given "Opening Number" has the props notes "Umbrellas from the store"
And "Campfire Sketch" has none
When someone opens the Overview
Then "Umbrellas from the store" shows in full under the Opening Number row, labelled as props notes
And nothing extra shows under Campfire Sketch

### AC8: No running order yet
Given a production with no saved running order
When someone opens the Overview
Then it says there is no running order yet and links to the Running order page

### AC9: Generate Props List is on the Overview
Given "jo" has no permissions
When jo chooses Generate Props List on the Overview
Then the Word props list downloads, as it does from today's Props view

### AC10: The props page links back to the Overview
Given someone on the props page for "Opening Number"
When they choose the link back
Then they're on the Overview
And the Previous and Next links still go to the neighbouring items' props pages

### AC11: Old addresses open the Overview
Given bookmarks to the Stage, Tech and Wardrobe pages, each with or without a view, to the Costume page, and to the older Production addresses for Props, Scenery, Mic plot and SFX
When each is opened
Then each opens the Overview
And a bookmark to an item's props page still opens that props page

### AC12: Usage records the Overview
Given team members have opened the Overview
When an admin opens the Usage page
Then the visits show under Production overview, apart from Casting's Overview
And past visits to the Stage, Tech and Wardrobe pages don't appear

### AC13: Help names the Overview
Given someone opens the Help page
When they read about Production
Then it describes the Overview, its Props button and Generate Props List
And it doesn't name Stage, Tech or Wardrobe as pages

## Notes

- FRs: FR3, FR4 (Props part), FR5 (Props), FR6, FR7, FR8, FR9, FR11, FR13
- Depends on: production-overview.E1.S1
- Mostly a move. Today's Props view (counts, notes, the empty state, Generate Props List) becomes the Overview, so its tests move with it.
- The square button is icon-only. It has a visible tooltip on hover and focus, and is at least 24 by 24 CSS pixels (PRD accessibility). The icon is a box (PRD constraints). The props item page's address may change, as long as AC11's bookmarks still work.
- Usage (AC12): Stage, Tech and Wardrobe join the retired pages that the Usage page no longer shows. Deleting their stored visits is E3.S2. The Stage and Tech views' switches stop being recorded, since the switches go.
- AC13 keeps Help true to the menu. E3.S1 then describes every button properly.
- The browser layout tests walk the menu and today's Props view. Ask before changing which pages they walk (CLAUDE.md).
- AC12 decided 2026-10-26: the Usage page and Help call the page "Production overview", since Casting's page is already "Overview" there. The menu and the page's own title say Overview.
- The props item page's address is now `/production/items/<item>/props`, ready for E2.S2's department pages beside it. The old `/production/stage/props/<item>` redirects.
- Out of scope: the Scenery, SFX, Mic plot and Wardrobe buttons (E2.S2), and the Welcome page's full description (E3.S1).
