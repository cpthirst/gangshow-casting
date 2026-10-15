---
id: casting-roles.E2.S2
title: Add and remove ensemble members
epic: E2
status: ready
---

## Story

As an item leader, I want to add and remove people in an ensemble role, so that the item's ensemble is recorded in full, not just its first member.

## Acceptance criteria

### AC1: Adding a member to an ensemble
Given the ensemble role "Pirates" has "Sam Example"
When I edit "Pirates", add "Alex Sample" and save
Then the "Pirates" card shows "Sam Example" and "Alex Sample"

### AC2: Ensemble members are listed by last name
Given "Pirates" has "Sam Example", "Zoe Adams" and "Ben Carter"
When I open the "Pirate Sketch" page
Then the "Pirates" card lists "Zoe Adams", "Ben Carter", "Sam Example"

### AC3: Removing a member from an ensemble
Given "Pirates" has "Sam Example" and "Alex Sample"
When I edit "Pirates", remove "Alex Sample" and save
Then the "Pirates" card shows only "Sam Example"

### AC4: Removing the last member leaves the ensemble uncast
Given "Pirates" has only "Sam Example"
When I edit "Pirates", remove "Sam Example" and save
Then the "Pirates" card shows "Uncast"

### AC5: Someone already in the ensemble isn't offered again
Given "Pirates" has "Sam Example"
When I edit "Pirates" and type "sam" to add a member
Then "Sam Example" is not offered

### AC6: An ensemble with several people can't become a single-person role
Given "Pirates" has "Sam Example" and "Alex Sample"
When I edit "Pirates", change its size to "Cameo" and save
Then I see "Leave one person in this ensemble before making it a Cameo role" next to the role size
And "Pirates" is unchanged

### AC7: An ensemble with one person can change size
Given "Pirates" has only "Sam Example"
When I edit "Pirates", change its size to "Cameo" and save
Then "Pirates" is listed among the cameos, played by "Sam Example"

### AC8: The API refuses repeated ensemble members
Given role 9 is an ensemble at revision 1
When a client puts role 9 with cast members [12, 12] and revision 1
Then the response is 400 and nothing changes

## Notes

- FRs: FR5, FR6
- Depends on: casting-roles.E2.S1.
- Listing ensemble members by last name, then first name, is the PRD's assumption (casting-item-overview Open questions).
- Long ensembles: the card wraps names. Folding a long list away is left for later, if the team finds it slow.
- Out of scope: adding several members in one step (PRD Open questions), target ensemble sizes.
