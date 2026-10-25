---
id: stage-props.E4.S3
title: Link roles to a prop, showing who's cast
epic: E4
status: done
---

## Story

As someone on the props team, I want to link a prop to the characters who use it and see who plays them, so that I know whose hands each prop goes into without checking the casting.

## Acceptance criteria

### AC1: A prop can have no roles
Given pat, with Stage, is adding "Treasure chest" to Pirate Sketch
When pat picks no roles and saves
Then the card shows "Treasure chest" with no roles

### AC2: A prop can have one role
Given Pirate Sketch has the role "Captain", cast as Sam Taylor
When pat adds "Telescope" with the role Captain
Then the card shows "Telescope", the role "Captain" and "Sam Taylor"

### AC3: A prop can have many roles
Given Pirate Sketch has the roles "Pirate 1", "Pirate 2" and "Pirate 3"
When pat adds "3 umbrellas" and picks all three roles in the multi-select
Then the card shows all three roles, each with its cast member

### AC4: Roles are picked from the item's own roles
Given pat is adding a prop to Pirate Sketch
When pat opens the role picker
Then it offers only Pirate Sketch's roles, by name, and can be searched and used by keyboard, as the ensemble picker can

### AC5: An uncast role is marked
Given the role "Parrot" has nobody cast
When a prop is linked to Parrot
Then the card shows "Parrot" with a clear "uncast" marker

### AC6: A role with several cast members shows them all
Given the role "Crew" is an ensemble of Jo Brown and Kim Lee
When a prop is linked to Crew
Then the card shows both names next to Crew

### AC7: Cast names follow the casting
Given "Telescope" is linked to Captain, cast as Sam Taylor
When the casting team recasts Captain as Lee Patel and pat reloads the props page
Then the card shows "Lee Patel", without anyone editing the prop

### AC8: A renamed role follows
Given "Telescope" is linked to Captain
When the casting team renames Captain to "Captain Hook"
Then the card shows "Captain Hook"

### AC9: A removed role leaves the prop
Given "Telescope" is linked to Captain and Pirate 1
When the casting team removes the role Captain
Then "Telescope" is still on the item, linked only to Pirate 1
And a prop whose only role is removed stays, with no roles

### AC10: Roles on a card are in the item's role order
Given a prop linked to Pirate 1 (a support role) and Captain (a lead)
When its card is shown
Then Captain comes before Pirate 1, as on the item's casting page

### AC11: The API refuses a role from another item
Given "Finale" has the role "Soloist"
When a request adds a prop to Pirate Sketch linked to Soloist
Then the response is 400, and nothing is added

## Notes

- FRs: FR17, FR18, FR21
- Depends on: stage-props.E4.S2
- A prop links to roles by id, never to cast members, so it holds no names of its own. Names come from the casting each time the page loads.
- Cast members show as first name and surname only (ADR 0010).
- The multi-select has a visible label (accessibility NFR). Long lists of roles and names wrap at 320px.
- Out of scope: changing a prop's roles after it's added (E4.S4).
