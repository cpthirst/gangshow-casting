---
id: production-props.E6.S4
title: Quantities and carriers in the Word props list
epic: E6
status: ready
---

## Story

As someone backstage, I want the printed props list to say how many of each prop there are and who carries them, so that it matches the props pages.

## Acceptance criteria

### AC1: The table shows each prop's quantity
Given Village Square has "Umbrella" with a quantity of 10 and "Telescope" with a quantity of 1
When the props list is generated
Then Village Square's table has a Qty column, showing 10 for Umbrella and 1 for Telescope

### AC2: The cast column shows only the carriers
Given "Bread basket" is linked to Villagers (Jo Brown, Kim Lee, Alex Green) and carried by Kim Lee
When the props list is generated
Then Bread basket's row shows Villagers with Kim Lee only

### AC3: When the cast fits, everyone is shown
Given "Umbrella", quantity 10, is linked to Villagers, with three villagers
When the props list is generated
Then its row shows Villagers with all three names

### AC4: Carriers left to choose are said
Given "Lantern", quantity 3, has only Jo Brown chosen
When the props list is generated
Then its row shows Jo Brown and says "2 left to choose"

### AC5: A role with no carriers is marked
Given "Lantern", quantity 1, is linked to Villagers and Baker, carried by Sam Taylor
When the props list is generated
Then Villagers' cast cell says nobody in it carries the prop, and Baker's shows Sam Taylor

### AC6: A prop with no roles still has its quantity
Given "Treasure chest", quantity 2, has no roles
When the props list is generated
Then its row shows 2, with empty Character and Cast cells

## Notes

- FRs: FR29
- Depends on: production-props.E6.S2
- Use the same wording as the props page cards, from one shared place, so the two can't drift apart.
- Add the quantity and carriers to ADR 0022's "Later changes" note for the Props List (what the file may hold). Carriers are still first names and surnames only.
- The Qty column is narrow, so the table still fits a portrait page.
