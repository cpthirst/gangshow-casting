---
id: casting-overview.E2.S1
title: Show each person's parts as role-size pills
epic: E2
status: done
---

## Story

As a member of the production team in a casting meeting, I want each person's card to show how many parts of each size they have, so that I can see who is carrying the most and who still needs casting.

## Acceptance criteria

### AC1: A pill per role size, with a count
Given "Sam Example" is a lead in one item and in three ensemble roles
When I open the Overview
Then Sam's card shows pills reading "Lead · 1" and "Ensemble · 3"

### AC2: Pills look the same as on role cards, biggest size first
Given "Alex Sample" has a cameo, a lead and a support role
When I open the Overview
Then Alex's pills read "Lead · 1", "Support · 1", "Cameo · 1", in that order
And each uses the same label and colour as that size's pill on an item's page

### AC3: Sizes they have no roles of aren't shown
Given "Sam Example" has only lead roles
When I open the Overview
Then Sam's card shows a lead pill and no other pills

### AC4: People with no parts are marked
Given "Jo Newcomer" is in no roles
When I open the Overview
Then Jo's card shows "No parts yet", styled like "Uncast" on a role card

### AC5: Each role counts once
Given "Sam Example" plays "Captain Hook" (lead) and "Parrot" (cameo) in the same item
And is one of five members of the ensemble "Pirates"
When I open the Overview
Then Sam's pills read "Lead · 1", "Cameo · 1", "Ensemble · 1"

### AC6: Only items in the saved running order count
Given "Sam Example" has a lead role in an item that isn't in the latest saved running order
When I open the Overview
Then that role isn't counted on Sam's card

### AC7: Pills are read out in words
Given Sam's card shows "Lead · 1" and "Ensemble · 3"
When a screen reader reads the card
Then it hears "1 lead, 3 ensemble"

### AC8: A failed roles or running-order load isn't shown as no parts
Given the cast loads but the roles or the running order can't be loaded
When I open the Overview
Then I see that the casting couldn't be loaded
And nobody is marked "No parts yet"

## Notes

- FRs: FR2, FR5 (marking), FR6, FR7, FR8 (roles and running order)
- Pill text changed on 2026-10-16 at the user's request: "Lead · 1" (a middle dot) rather than "Lead ×1".
- Depends on: casting-overview.E1.S1.
- Counting is a plain function (per person: roles by size, from roles whose item is in the latest saved running order), unit-tested on its own.
- No new API: also reads `GET /roles` and the running order.
- Out of scope: ordering by score (E2.S2), showing which items the parts are in (PRD non-goal).
