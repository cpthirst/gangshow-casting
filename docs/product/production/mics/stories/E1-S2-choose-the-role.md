---
id: production-mics.E1.S2
title: Show the role for each mic
epic: E1
status: done
---

## Story

As someone in the Tech team, I want each mic to show the role its cast member plays in the item, so that the sound desk knows which character is on which channel.

## Acceptance criteria

### AC1: A mic shows every role its cast member plays in the item
Given Alex Morgan is on Mic 3 in "Space Sketch", where Alex is cast as "Alien 1" and "Narrator", and "Captain" is cast to Sam Patel
When anyone signed in opens its Mic plot page
Then Mic 3 shows "Alex Morgan" and "Narrator, Alien 1", biggest part first, as plain text
And not "Captain"

### AC2: A cast member only in an ensemble shows the ensemble
Given Jo Reed is cast in "Space Sketch" only in the "Chorus" ensemble
When someone with Tech gives Mic 4 to Jo Reed
Then Mic 4 shows "Jo Reed" and "Chorus"

### AC3: Changing the cast member changes the role
Given Mic 3 in "Space Sketch" is Alex Morgan, shown as "Narrator, Alien 1"
When someone with Tech changes Mic 3 to Sam Patel
Then Mic 3 shows "Captain"

### AC4: The role follows the casting
Given Mic 3 in "Space Sketch" is Alex Morgan, shown as "Narrator, Alien 1"
When Alex is also cast in "Space Sketch" as "Robot", or "Alien 1" is renamed "Alien Leader"
Then the next time the page is opened Mic 3 shows the roles Alex plays now

### AC5: Nobody types or chooses a role
Given any account, with or without Tech or Director
When they open the Mic plot page for "Space Sketch"
Then each channel's role is plain text, with no field to change it
And the mic plot saves no role: a request that gives a mic a role is refused

## Notes

- FRs: FR3
- Depends on: production-mics.E1.S1
- Decided 2026-11-03: the role is not chosen. A mic shows every role its cast member plays in the item, ensembles included, biggest part first, worked out from the casting each time the page is shown. Nothing about the role is saved with the mic, so it always matches the casting. This replaces the earlier role picker.
- The role is written after the cast member in the channel's card, for everyone, so it reads the same with or without Tech.
- Out of scope: freeing a channel when casting takes someone out of the item (E2.S3).
