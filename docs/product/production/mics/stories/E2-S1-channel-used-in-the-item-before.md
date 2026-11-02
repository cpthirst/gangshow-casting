---
id: production-mics.E2.S1
title: Grey out a channel used by someone else in the item before
epic: E2
status: ready
---

## Story

As someone in the Tech team, I want a channel that was on someone else in the item straight before to be greyed out, so that I can never plan a mic changeover there isn't time for.

## Acceptance criteria

### AC1: A channel used by someone else in the item before is greyed out
Given "Opening Number" is followed by "Space Sketch" in Act 1, and Mic 1 is Alex Morgan's in "Opening Number"
When someone with Tech opens the Mic plot page for "Space Sketch"
Then Mic 1 is greyed out and disabled, reading "Used in previous item"
And it can't be chosen by mouse, keyboard or screen reader

### AC2: The same person can keep it
Given Mic 1 is Alex Morgan's in "Opening Number", and Alex is cast in "Space Sketch"
When someone with Tech gives Mic 1 to Alex in "Space Sketch"
Then it's saved, and Mic 1 shows Alex Morgan
And no one else is offered for Mic 1 in "Space Sketch"

### AC3: Short items are no exception
Given "Opening Number" is followed by a 1-minute "Link" item, and Mic 2 is Sam Patel's in "Opening Number"
When someone with Tech opens the Mic plot page for "Link"
Then Mic 2 is greyed out for anyone but Sam Patel

### AC4: The first item of the show can use any channel
Given "Opening Number" is the first item of Act 1
When someone with Tech opens its Mic plot page
Then no channel is greyed out

### AC5: The rule resets at the interval
Given "Act 1 Finale" ends Act 1 with Mic 1 given to Alex Morgan, and "Entr'acte" opens Act 2
When someone with Tech opens the Mic plot page for "Entr'acte"
Then Mic 1 is not greyed out, and can be given to anyone in the item

### AC6: A mic can stay with someone across items that aren't back to back
Given Mic 5 is Jo Reed's in item 1, item 2 doesn't use Mic 5, and Jo is in item 3
When someone with Tech gives Mic 5 to Jo in item 3
Then it's saved, with nothing else to do

### AC7: The API refuses a blocked channel
Given Mic 1 is Alex Morgan's in "Opening Number", the item before "Space Sketch"
When a request gives Mic 1 in "Space Sketch" to Sam Patel, however it's made
Then it is refused and nothing changes

### AC8: Read-only accounts see the same greying
Given an account without Tech or Director
When they open the Mic plot page for "Space Sketch"
Then Mic 1 reads "Used in previous item" for them too

## Notes

- FRs: FR5, FR6, FR7
- Depends on: production-mics.E1.S1
- "Used in previous item" is in the channel's accessible name, not only its colour, and its text still meets contrast (PRD accessibility). No warnings or info icons (PRD non-goals).
- The item before is the one directly before in the latest saved running order, in the same half.
- Out of scope: an allocation a later reorder makes break the rule (E2.S2).
