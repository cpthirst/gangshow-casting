---
id: casting-roles.E1.S2
title: Refuse a role name already used in the item
epic: E1
status: ready
---

## Story

As a member of the production team, I want the app to stop me adding the same part twice to an item, so that each part in an item is recorded once and there's no confusion about who plays it.

## Acceptance criteria

### AC1: A repeated name in the same item is refused
Given "Pirate Sketch" has a role "Captain Hook"
When I add another role named "Captain Hook" to "Pirate Sketch"
Then I see "Pirate Sketch already has a role called Captain Hook" next to the role name
And no role is added

### AC2: Case and surrounding spaces don't make a name different
Given "Pirate Sketch" has a role "Captain Hook"
When I add a role named " captain hook " to "Pirate Sketch"
Then it is refused with the same message
And no role is added

### AC3: The same name is allowed in a different item
Given "Pirate Sketch" has a role "Narrator"
When I add a role named "Narrator" to "Campfire Song"
Then "Narrator" is added to "Campfire Song"

### AC4: The API refuses a repeated name
Given "pirate-sketch" has a role "Captain Hook"
When a client posts a role named "CAPTAIN HOOK" for "pirate-sketch"
Then the response is 400 with an error on the role name
And nothing is stored

## Notes

- FRs: FR3 (duplicate name)
- Depends on: casting-roles.E1.S1.
- The check runs in the API against the stored roles, so two people adding the same name at once can't both succeed.
- Renaming an existing role to a used name is checked in E2.S1.
