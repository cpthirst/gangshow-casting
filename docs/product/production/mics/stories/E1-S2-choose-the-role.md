---
id: production-mics.E1.S2
title: Choose the role for each mic
epic: E1
status: ready
---

## Story

As someone in the Tech team, I want each mic to show the role its cast member plays in the item, so that the sound desk knows which character is on which channel.

## Acceptance criteria

### AC1: The role comes from the cast member's casting roles in the item
Given Alex Morgan is on Mic 3 in "Space Sketch", where Alex is cast as "Alien 1" and "Narrator", and "Captain" is cast to Sam Patel
When someone with Tech chooses the role for Mic 3
Then they can choose "Alien 1" or "Narrator", but not "Captain"
And after choosing "Alien 1", Mic 3 shows "Alex Morgan" and "Alien 1" for everyone

### AC2: A cast member without a named part has the role left blank
Given Jo Reed is cast in "Space Sketch" without a named role
When someone with Tech gives Mic 4 to Jo Reed
Then Mic 4 shows "Jo Reed" with the role blank, and no roles are offered

### AC3: Changing the cast member clears the role
Given Mic 3 in "Space Sketch" is Alex Morgan as "Alien 1"
When someone with Tech changes Mic 3 to Sam Patel
Then the role is blank until a role of Sam's is chosen

### AC4: The API refuses a role the cast member doesn't have
Given Alex Morgan is on Mic 3 in "Space Sketch"
When a request gives Mic 3 the role "Captain", or a role from another item
Then it is refused and nothing changes

### AC5: Read-only accounts see the role but can't change it
Given an account without Tech or Director
When they open the Mic plot page for "Space Sketch"
Then they see each channel's role, with no way to change it

## Notes

- FRs: FR3
- Depends on: production-mics.E1.S1
- Role pickers are labelled "Mic 3 role".
- Out of scope: what happens when casting changes afterwards (E2.S3).
