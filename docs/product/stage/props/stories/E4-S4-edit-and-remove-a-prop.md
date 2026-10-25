---
id: stage-props.E4.S4
title: Edit and remove a prop
epic: E4
status: ready
---

## Story

As someone on the props team, I want to fix a prop's name or roles, and take a prop off an item, so that the list stays right as the show changes at rehearsals.

## Acceptance criteria

### AC1: Stage edits a prop's name
Given pat, with Stage, is on Pirate Sketch's props page, which has "Treasure chest"
When pat chooses the pencil on its card, changes the name to "Gold chest" and saves
Then the card shows "Gold chest", in its alphabetical place, and it's still there on reload

### AC2: Stage changes a prop's roles
Given "Telescope" is linked to Captain
When pat edits it, adds Pirate 1, removes Captain and saves
Then the card shows only Pirate 1, with its cast

### AC3: Cancelling an edit changes nothing
Given pat is editing "Telescope"
When pat cancels
Then the card shows the prop as it was

### AC4: An edited prop still needs a name
Given pat is editing "Telescope"
When pat clears the name and saves
Then it isn't saved, and the name field says a prop needs a name

### AC5: Stage removes a prop, confirming first
Given Pirate Sketch has "Telescope"
When pat chooses the trash can on its card
Then pat is asked "Remove the prop Telescope from Pirate Sketch?"
And when pat confirms, the card is gone, and the Props page counts one prop fewer

### AC6: Cancelling a removal keeps the prop
Given pat chose the trash can on "Telescope"
When pat cancels the confirmation
Then "Telescope" is still there

### AC7: Without Stage there's no pencil or trash can
Given "sam" has the Casting permission only
When sam opens Pirate Sketch's props page
Then the prop cards show no pencil and no trash can

### AC8: The API refuses edits and removals from anyone without Stage
Given "sam" has the Casting permission only
When sam sends a request to edit or remove a prop
Then the response is 403 saying "You can view the props, but not change them.", and the prop is unchanged

### AC9: A prop that's already gone
Given someone else removed "Telescope" after pat's page loaded
When pat edits or removes it
Then pat is told it's no longer there, and the page shows the props as they are now

### AC10: A failed save keeps the edit
Given pat is editing "Telescope"
When saving fails
Then pat is told, and the edit is still in the form

## Notes

- FRs: FR19
- Depends on: stage-props.E4.S3
- The pencil and trash can have accessible names that include the prop, such as "Edit Telescope" and "Remove Telescope", as role cards do.
- Editing uses the same form as Add prop.
- Out of scope: props notes (E4.S5).
