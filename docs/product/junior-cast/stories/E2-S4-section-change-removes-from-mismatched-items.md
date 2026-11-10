---
id: junior-cast.E2.S4
title: Changing a member's section removes them from items they no longer match
epic: E2
status: done
---

## Story

As someone who keeps the cast list, I want a cast member who moves gang, such as from Cubs to Scouts, to leave the roles of items that aren't for their new gang, after I've seen which, so that no one stays cast in an item they won't be at.

## Acceptance criteria

### AC1: Saving lists the roles they'll be removed from
Given "Ollie Sample" is in Cubs
And is cast as "Chief Beaver" in "Beaver Bop" (Junior), in "Dam Builders" in "Beaver Bop", and in "Finale Chorus" in "Grand Finale" (Both)
When someone who can edit the cast changes Ollie Sample's section to Scouts and chooses Save
Then they're asked to confirm that saving removes Ollie Sample from Chief Beaver and Dam Builders in Beaver Bop
And Finale Chorus in Grand Finale isn't listed

### AC2: Going back saves nothing
Given the confirmation from AC1 is showing
When they go back
Then Ollie Sample's section is still Cubs
And their roles are unchanged

### AC3: Confirming changes the section and removes them
Given the confirmation from AC1 is showing
When they confirm
Then Ollie Sample's section is Scouts
And they're no longer cast in Chief Beaver or Dam Builders, and still cast in Finale Chorus

### AC4: No confirmation when no item is affected
Given "Sam Specimen" is in Scouts and cast only in Senior items
When someone changes Sam Specimen's section to Explorers and saves
Then the change saves with no confirmation about removals

### AC5: Clearing the section counts as Senior
Given "Poppy Example" is in Beavers and cast in "Beaver Bop" (Junior)
When someone clears Poppy Example's section and saves
Then they're asked to confirm that saving removes Poppy Example from their roles in Beaver Bop

### AC6: Their props and mic channels follow
Given Ollie Sample carries the prop "Paddle" and has channel 2 in Beaver Bop
When their section is changed to Scouts and the change is confirmed
Then Ollie Sample no longer carries the Paddle and channel 2 is free in Beaver Bop

### AC7: The server removes them whatever the client does
Given Ollie Sample's casting as in AC1
When a client changes Ollie Sample's section to Scouts without asking anyone
Then Ollie Sample is removed from Chief Beaver and Dam Builders, and still cast in Finale Chorus

### AC8: Help describes it
Given the Help page
When someone reads the Cast page's entry
Then it describes that changing a member's section removes them from items for the other gang

## Notes

- FRs: FR12, FR6, FR11
- Depends on: E2.S3 (removing people who don't match an item's gang)
- Editing a cast member needs the casting permission, as today; that refusal is already in place.
- Use the same removal as a gang change (E2.S3): one rule finds who in an item doesn't match its gang, and both the running order save and the cast member save use it. The confirmation reuses the same list of "who leaves which roles".
- AC6 comes from the clean-up every casting change already runs. Check it runs after a section change; don't test the clean-up again.
- Logs and errors never include names.
- AC8 checks Help's structure, not its wording.
