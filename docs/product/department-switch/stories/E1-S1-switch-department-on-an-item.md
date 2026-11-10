---
id: department-switch.E1.S1
title: Switch department on an item
epic: E1
status: done
---

## Story

As a stage manager looking at one item, I want to open another Production department's page for the same item in one tap, so that I can check its props, mics or wardrobe without going back to the Overview.

## Acceptance criteria

### AC1: Every Production department is in the switch, in the Overview's order
Given "Pirate Sketch" is in the saved running order
When I open the Props page for "Pirate Sketch"
Then the page shows a department switch with Scenery, Props, SFX, Mic plot and Wardrobe, in the order the Production overview's buttons show them

### AC2: Choosing a department opens its page for the same item
Given I'm on the Props page for "Pirate Sketch"
When I choose Wardrobe in the department switch
Then the Wardrobe page for "Pirate Sketch" opens, titled "Wardrobe: Pirate Sketch"

### AC3: The department you're in is marked as current
Given I'm on the Mic plot page for "Pirate Sketch"
When I look at the department switch
Then Mic plot is marked as the current page and isn't a link
And the other four departments are links

### AC4: Previous and Next stay in the department you're in
Given "Pirate Sketch" comes after "Opening Number" in the running order
And I opened the Props page for "Pirate Sketch" through the department switch
When I choose Previous
Then the Props page for "Opening Number" opens

### AC5: The switch shows on every Production item page
Given "Pirate Sketch" is in the saved running order
When I open its Scenery, Props, SFX, Mic plot or Wardrobe page
Then each of them shows the department switch

### AC6: The Casting item page has no switch
Given "Pirate Sketch" is in the saved running order
When I open its Casting page
Then the page shows no department switch

### AC7: No switch until the item has loaded
Given an item that isn't in the latest saved running order, or a running order that fails to load
When I open that item's SFX page
Then the page shows the not-found or error state, with no department switch

### AC8: Unsaved notes aren't lost without asking
Given I've typed Props notes for "Pirate Sketch" and not saved them
When I choose SFX in the department switch
Then I'm asked whether to discard my unsaved notes
And if I say no, I stay on the Props page with my notes as I typed them

### AC9: A visit through the switch is recorded
Given I'm on the Props page for "Pirate Sketch"
When I choose Scenery in the department switch
Then a Scenery visit for "Pirate Sketch" is recorded for the Usage page

### AC10: Everyone sees the same switch
Given I'm signed in with only read-only access
When I open the Props page for "Pirate Sketch"
Then the department switch shows all five departments, with every one but Props as a link

### AC11: Icons only at phone width
Given a screen 360px wide
When I open the SFX page for "Pirate Sketch"
Then each department in the switch shows its icon without its name
And each one's name is its tooltip and the name a screen reader announces

### AC12: Names show on wider screens
Given a screen 1024px wide
When I open the SFX page for "Pirate Sketch"
Then each department in the switch shows its icon and its name

### AC13: Help describes the switch
Given I open Help for a Production item page
When I read its list of controls
Then it has an entry for the department switch
And the Casting item page's Help has none

### AC14: The switch fits a phone on one row
Given a screen 320px or 360px wide
When I open the Mic plot page for an item with a long title
Then the department switch takes one row
And nothing scrolls sideways

## Notes

- FRs: FR1–FR12
- Depends on: none
- The switch belongs in the shared item frame ([ItemPageFrame.vue](../../../../apps/web/src/components/common/ItemPageFrame.vue)), reading the shared `departmentPages` list, which already holds the Overview's order and icons. Test it once, in the frame's or the switch's own test file. Each page keeps only its one check that the frame is wired up (AC5).
- The frame also serves the Casting item page, so the switch shows only for Production departments (AC6).
- AC8 and AC9 are already met by the shared frame: the notes ask before you leave any item page, and the frame records a visit when the item is found. They need a check that the switch triggers them, not a second full test.
- AC11 and AC12 go through the browser layout tests or a CSS check, since happy-dom doesn't apply media queries. Agree where each is tested at implementation time.
- AC13: the item pages share their Help lines for All items, Previous and Next, so the switch's line joins the Production ones there. Check structure, not wording (CLAUDE.md, "Don't pin content").
- AC14: the user agreed to this new browser layout check (2026-11-10). Use only the made-up data in `apps/web/e2e/data`.
- Out of scope: the Casting item page, and counts or badges in the switch (PRD non-goals).
