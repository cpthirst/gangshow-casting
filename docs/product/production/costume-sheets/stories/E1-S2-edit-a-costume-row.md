---
id: production-costume-sheets.E1.S2
title: Record what each cast member wears in an item
epic: E1
status: done
---

## Story

As someone on the Wardrobe team, I want to record, for each cast member in each role, what Wardrobe provides, what they bring and my own notes, so that it is written down once and kept with the item.

## Acceptance criteria

### AC1: A row shows its three fields
Given Alex Morgan as "Captain Hook" in "Opening Number" has From Wardrobe "Red coat, hook", From Cast Member "Black shoes" and Notes "Hem the coat"
When anyone signed in opens the Wardrobe page for "Opening Number"
Then the row shows "From Wardrobe" with "Red coat, hook", "From Cast Member" with "Black shoes" and "Notes" with "Hem the coat"
And a row nobody has filled in shows only its role and name

### AC2: The pencil turns the row into one form for all three fields
Given "kit" has Wardrobe and is on the Wardrobe page for "Opening Number"
When kit chooses the pencil on Alex Morgan's "Captain Hook" row
Then the row becomes a form named "Edit Alex Morgan as Captain Hook" with labelled fields From Wardrobe, From Cast Member and Notes, holding the row's current text, a Save button and a Cancel button
And the first field has focus

### AC3: One Save stores all three fields
Given kit is editing Alex Morgan's "Captain Hook" row
When kit types "Red coat, hook" in From Wardrobe, "Black shoes" in From Cast Member and "Hem the coat" in Notes, and chooses Save
Then the form shows it is saving, then the row shows all three texts, screen readers are told the costume was saved
And anyone opening the page later sees the same three texts

### AC4: Cancel and Escape put the row back unchanged
Given kit is editing Alex Morgan's row and has typed "Blue coat" over "Red coat, hook"
When kit chooses Cancel, or presses Escape
Then the row shows "Red coat, hook" again and nothing was saved
And focus returns to the row's pencil

### AC5: One row in edit at a time
Given kit is editing Alex Morgan's row
When kit chooses the pencil on Jo Brown's "Pirates" row
Then Jo Brown's row becomes the form and Alex Morgan's row shows its saved text, with the unsaved typing dropped

### AC6: The form says sizes and measurements stay out
Given kit is editing any row
When the form is shown
Then it has one line beside the fields saying sizes and measurements don't go here, as the upload area says photos don't

### AC7: Saving over 500 characters is refused
Given kit is editing Alex Morgan's row
When kit types 501 characters in From Wardrobe and chooses Save
Then the form keeps the text, says the field can hold 500 characters, and nothing is saved
And the API refuses a save with a field over 500 characters with 400

### AC8: Wardrobe, Director and admins can change costumes; nobody else
Given "kit" has Wardrobe, "dee" has Director, "ann" is an admin and "lee" has Tech only
When each opens the Wardrobe page for "Opening Number"
Then kit, dee and ann see a pencil on every cast row and lee sees none, with the page's View only badge
And the API refuses lee's save with 403 saying "You can view the wardrobe, but not change it."

### AC9: The API refuses a costume that doesn't fit the casting
Given "Opening Number" has "Captain Hook" played by Alex Morgan, and "Finale" is another item
When a save names a role that isn't in "Opening Number", a cast member who isn't in "Captain Hook", or an item not in the latest saved running order
Then the API refuses it with 400 for the role or cast member, and 404 for the item, and nothing is saved

### AC10: Costumes belong to their production
Given production 2027 has Alex Morgan's "Captain Hook" costume in "Opening Number"
When the API lists the costumes of another production
Then Alex Morgan's costume isn't among them

### AC11: Cutting an item takes its costumes with it
Given "Cut Sketch" has three costume rows filled in, a Wardrobe file and a Wardrobe note
When the running order is saved without "Cut Sketch"
Then its costumes are deleted along with its files and notes, in the same clean-up
And nothing is deleted before the save

## Notes

- FRs: FR1, FR4, FR5, FR6, FR7 (the API's refusals; the stale save is E1.S3), FR8 (the cut; the rest is E1.S3)
- Depends on: production-costume-sheets.E1.S1
- A costume is one record per cast member per role per item in a production, each field up to 500 characters (the item notes' limit, said once). The request and response shapes go in the shared schemas first.
- The store joins the per-item stores, so it is in the clean-up by itself; the story adds the test that it is. Both a file store and a Dynamo store, with the shared contract tests.
- The pencil-to-form row is the prop card's flow (production-props FR19) and should share its pieces (the card's icons, the form's field and error markup, the focus handling) rather than copy them.
- Expected to pass the ~400-line guideline (story map, "Order"); kept whole by choice.
- Out of scope: the stale-save refusal, recasts, role removal and cast member deletion (E1.S3); the export (E2.S2); Help (E3.S1).
