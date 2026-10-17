---
id: cast-management.E3.S1
title: Note how each cast member sings and acts
epic: E3
status: done
---

## Story

As a member of the production team, I want short Singing and Acting notes on each cast member, shown in the cast list, so that I can cast parts with those notes in front of me.

## Acceptance criteria

### AC1: Adding someone with notes
Given I'm adding "Jo Newcomer"
When I enter Singing "Strong alto, can solo" and Acting "Comic timing" and save
Then the cast list shows those notes in Jo's Singing and Acting columns

### AC2: The notes are optional
Given I'm adding "Sam Example"
When I leave Singing and Acting empty and save
Then Sam is added, with nothing in those columns

### AC3: Editing the notes
Given Jo's Singing note is "Strong alto, can solo"
When I edit it to "Alto, harmonies" and save
Then the cast list shows "Alto, harmonies"

### AC4: Each note is up to 100 characters
Given I'm adding or editing a cast member
When I enter 101 characters in Singing or Acting and save
Then I see, next to that field, that it can be up to 100 characters
And nothing is saved

### AC5: The notes are columns in the cast list
Given the cast list
When I look at its columns
Then Singing and Acting come after Group

### AC6: On phones they're labelled lines on each card
Given Jo has both notes and Sam has none
When I open the cast list on a phone
Then Jo's card shows "Singing" and "Acting" lines, Sam's shows neither
And the page doesn't scroll sideways

### AC7: They aren't filterable
Given the cast list's filters
When I look at them
Then I can filter by first name, last name and section only, as before

### AC8: Existing cast members start blank
Given cast members saved before this change
When I open the cast list
Then they load as before, with blank Singing and Acting

## Notes

- FRs: FR9
- Depends on: cast-management.E2.S2 (editing a cast member), done.
- Decision: ADR 0014 (accepted 2026-10-16 with this story) extends ADR 0010 to allow these two notes, and CLAUDE.md's safeguarding rule is updated to match.
- Added on 2026-10-16 at the user's request.
- Out of scope: filtering or sorting by the notes; fixed ratings; showing the notes on the casting pages.
