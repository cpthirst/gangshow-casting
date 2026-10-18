---
id: casting-overview-grid.E2.S1
title: See who is in which item in a grid
epic: E2
status: done
---

## Story

As a member of the production team, I want a table of people against items, so that I can see who is in which item and spot gaps and heavy loads at a glance.

## Acceptance criteria

The examples use this running order: 1 "Opening Number", 2 "Pirate Sketch", 3 "Dance One". "Sam Example" (Scouts) is "Captain Hook" (lead) in "Pirate Sketch" and a cameo in "Dance One". "Alex Sample" (Explorers) is a support in "Opening Number". "Jo Newcomer" (Scouts) is in no roles.

### AC1: Switching to the grid
Given I am on the Overview showing people by section
When I choose the grid view
Then I see a table on the same page, not a different page

### AC2: Switching back
Given the Overview is showing the grid
When I choose the by-person view
Then I see the people by section as before

### AC3: One row per person
Given the cast above
When I look at the grid
Then there is a row each for Sam Example, Alex Sample and Jo Newcomer
And each row starts with first name, last name and section

### AC4: One column per item in running order
Given the running order above
When I look at the grid
Then the item columns run "Opening Number", "Pirate Sketch", "Dance One" from left to right

### AC5: A dot for the role held
Given Sam is a lead in "Pirate Sketch"
When I look at Sam's cell under "Pirate Sketch"
Then it holds one dot in the lead colour with the letter L

### AC6: Each size has its own colour and letter
Given Alex is a support and Sam is a cameo
When I look at their cells
Then Alex's dot is in the support colour with S
And Sam's "Dance One" dot is in the cameo colour with C
And an ensemble dot is in the ensemble colour with E

### AC7: Several roles in one item show the biggest
Given Sam is "Captain Hook" (lead) and also a cameo in "Pirate Sketch"
When I look at Sam's "Pirate Sketch" cell
Then it holds one dot, the lead dot with L

### AC8: No casting leaves the cell empty
Given Sam is not in "Opening Number"
When I look at Sam's "Opening Number" cell
Then it holds no dot and is visibly empty

### AC9: Ensemble parts show as E
Given Alex is only in the "Pirates" ensemble in "Pirate Sketch"
When I look at Alex's "Pirate Sketch" cell
Then it holds one dot in the ensemble colour with the letter E

### AC10: A bigger part beats ensemble
Given Sam is "Captain Hook" (lead) and also in the "Pirates" ensemble in "Pirate Sketch"
When I look at Sam's "Pirate Sketch" cell
Then it holds one dot, the lead dot with L

### AC11: People are ordered by section
Given Scouts and Explorers in the cast
When I look at the grid
Then the rows follow the same section order as the by-person view

### AC12: Someone in no items still has a row
Given Jo is in no roles
When I look at the grid
Then Jo's row is there with every item cell empty

### AC13: No running order
Given the show has no items
When I choose the grid view
Then I see a message that there are no items yet, not an empty table

### AC14: Reads as a table to screen readers
Given the grid is showing
When a screen reader reads Sam's "Pirate Sketch" cell
Then it announces Sam, "Pirate Sketch" and "Lead"

### AC15: A clash shows beside the name
Given Sam is a lead in "Opening Number" and a support in "Pirate Sketch", back to back
When I look at the grid
Then Sam's name cell shows the same clash icon as on the by-person card
And Alex, who has no clash, has none

### AC16: No cast
Given the cast is empty
When I open the Overview
Then I see "No cast members yet." with no switch and no table

### AC17: The casting fails to load
Given the roles can't be loaded
When I choose the grid view
Then I see "Couldn't load the grid." and no table

### AC18: The grid scrolls in its own named box
Given the grid is showing
When a screen-reader or keyboard user reaches it
Then it sits in a focusable region named "Who is in which item", styled like the app's other tables

## Notes

- FRs: FR4, FR5, FR6, FR7, FR8, FR11
- Depends on: casting-overview-grid.E1.S1
- The grid is read-only. Colours are the ones lead, support, cameo and ensemble already use elsewhere.
- The by-person and grid views share one intro sentence, and the switch is named "Choose how to see the cast".
- Out of scope: sticky columns, item header detail and sideways scrolling (E2.S2), the legend (E2.S3).
