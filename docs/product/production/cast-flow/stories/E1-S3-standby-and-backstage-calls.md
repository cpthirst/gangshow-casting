---
id: production-cast-flow.E1.S3
title: Add the Standby and Backstage calls
epic: E1
status: done
---

## Story

As a stage manager, I want the Cast flow graph to show who has been called to Backstage and to Standby before each item, so that I can see when the holding area and the wings get crowded.

## Acceptance criteria

The examples use this made-up 2027 production. The running order starts at 19:00 with a 20-minute interval. First half: 1 "Opening" (19:00–19:10; an ensemble of 30), 2 "Campfire Sketch" (19:10–19:15; 4 people, 2 of whom, Sam Sample and Jo Placeholder, are also in Opening), 3 "Gang Song" (19:15–19:25; 12 people in no other first-half item, plus Robin Madeup, who is also in Opening). Second half: 4 "Finale" (19:45–19:53; 40 people). The cast list has 60 people.

### AC1: Cast are Backstage from 6 minutes before their item
Given the 2027 production
When someone opens Cast flow
Then from 19:09 to 19:11 Gang Song's 12 are counted Backstage

### AC2: Cast are in Standby from 4 minutes before their item
Given the 2027 production
When someone opens Cast flow
Then from 19:11 to 19:15 the Standby line is at 13: Gang Song's 12, and Robin Madeup (see AC5)

### AC3: The graph starts at the first call before curtain up
Given Opening starts at 19:00
When someone opens Cast flow
Then the time along the bottom starts at 18:54
And Opening's 30 are Backstage from 18:54 to 18:56 and in Standby from 18:56 to 19:00

### AC4: On stage beats a call for the next item
Given Sam Sample and Jo Placeholder are in Opening and Campfire Sketch, back to back
When someone opens Cast flow
Then they are counted On-stage from 19:00 to 19:15, never in Standby or Backstage

### AC5: Coming off stage into a call goes straight to it
Given Robin Madeup leaves the stage at 19:10 and is in Gang Song at 19:15
When someone opens Cast flow
Then Robin is counted Backstage from 19:10 to 19:11 and in Standby from 19:11 to 19:15, never in the Dressing Room

### AC6: Standby beats Backstage when calls overlap
Given someone is in two items starting 3 minutes apart
When the second item's Backstage call comes while they're in Standby for the first
Then they are counted once, in Standby

### AC7: Calls for the second half start in the interval
Given the interval runs from 19:25 to 19:45 and Finale starts at 19:45
When someone opens Cast flow
Then Finale's 40 are Backstage from 19:39 to 19:41 and in Standby from 19:41 to 19:45

### AC8: The four places always add up to the cast list
Given the 2027 production
When someone opens Cast flow
Then at every time on the graph, On-stage, Standby, Backstage and Dressing Room add up to 60

## Notes

- FRs: FR3, FR5, FR6, FR8, FR9, FR10
- Depends on: E1.S2
- The call times (6 and 4 minutes) are fixed for everyone (PRD non-goal: no setting). Each is a single value that the counting and Help (E2.S1) both read.
- Counts change only at call times and item boundaries, so the graph needs points only there, not every minute.
- The rules are tested in the plain counting logic from E1.S2. The page needs no new test beyond the two new lines appearing.
- Out of scope: hiding lines and the key's descriptions (E2.S1); hover and the table (E2.S2).
