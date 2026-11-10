---
id: junior-cast.E2.S2
title: Cast each role only from the item's gang
epic: E2
status: ready
---

## Story

As someone casting a show item, I want the cast member search to offer only the gang the item is for, so that I can't put anyone in an item they won't be at.

## Acceptance criteria

### AC1: A Junior item's search offers only the Junior gang
Given "Beaver Bop" is for the Junior gang
And "Sam Example" is in Cubs and "Sam Sample" is in Scouts
When someone casting a role in Beaver Bop searches for "Sam"
Then Sam Example is offered and Sam Sample is not

### AC2: A Senior item's search offers the Senior gang, including no section
Given "Pirate Sketch" is for the Senior gang
And "Sam Example" is in Cubs, "Sam Sample" is in Scouts and "Sam Newcomer" has no section
When someone casting a role in Pirate Sketch searches for "Sam"
Then Sam Sample and Sam Newcomer are offered and Sam Example is not

### AC3: An item for both gangs offers everyone
Given "Grand Finale" is for both gangs
When someone casting a role in Grand Finale searches for "Sam"
Then Sam Example, Sam Sample and Sam Newcomer are all offered

### AC4: Every role size follows the item's gang
Given "Beaver Bop" is for the Junior gang, with a Lead role "Chief Beaver" and an Ensemble role "Dam Builders"
When someone searches for "Sam" in each role's cast field
Then both offer Sam Example and neither offers Sam Sample

### AC5: The server refuses casting someone outside the item's gang
Given "Beaver Bop" is for the Junior gang and "Sam Sample" is in Scouts
When a client adds or changes a role in Beaver Bop to cast Sam Sample
Then the request is refused as invalid with "Sam Sample isn't in the Junior gang"
And the role is unchanged

### AC6: Help describes how an item's gang filters casting
Given the Help page
When someone reads the Casting item page's entry
Then it describes that the cast search offers only the item's gang

## Notes

- FRs: FR4, FR11
- Depends on: E1.S2 (the one gang rule), E2.S1 (the item's gang)
- The search reads the same gang rule as the Cast page's filter (E1.S2). The cast member picker is shared by every role size, so filter it once there, not per role size.
- People already cast before this story who don't match stay cast until the item's gang next changes (E2.S3). The search only shapes who can be added.
- AC5's message is a refusal, so its wording is the requirement. It doesn't name a section or say anything about age.
- Out of scope: removing people when an item's gang changes (E2.S3); the Props carriers and Mic plot pickers, which already offer only the item's cast.
