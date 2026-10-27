---
id: production-props.E6.S2
title: Choose who carries a prop
epic: E6
status: done
---

## Story

As someone on the props team, I want to choose which of an ensemble carries a prop, so that "Bread basket" goes to the one villager who carries it, not to every villager.

## Acceptance criteria

### AC1: Everyone carries it when the cast fits the quantity
Given the role "Captain" is cast as Sam Taylor
When pat adds "Telescope", quantity 1, linked to Captain
Then the form offers no carrier picker
And the card shows Captain and Sam Taylor, as it does today

### AC2: A quantity covering the whole ensemble needs no choosing
Given the ensemble "Villagers" is Jo Brown, Kim Lee and Alex Green
When pat adds "Umbrella", quantity 10, linked to Villagers
Then the form offers no carrier picker
And the card shows all three villagers

### AC3: More cast than the quantity offers a carrier picker
Given the ensemble "Villagers" is Jo Brown, Kim Lee and Alex Green
When pat adds "Bread basket", quantity 1, and links it to Villagers
Then the form shows a labelled "Who carries it" picker of Jo Brown, Kim Lee and Alex Green, saying "Choose up to 1"

### AC4: The card shows only the chosen carriers
Given pat is adding "Bread basket", quantity 1, linked to Villagers
When pat chooses Kim Lee and saves
Then the card shows Villagers with only Kim Lee, and it's still there on reload

### AC5: No more than the quantity can be chosen
Given pat is adding "Bread basket", quantity 2, linked to Villagers
When pat has chosen Jo Brown and Kim Lee
Then the picker says none are left to choose, and its search is turned off, so Alex Green can't be chosen until one is removed

### AC6: Carriers come only from the prop's roles
Given Village Square has the roles "Villagers" and "Baker", and the prop is linked only to Villagers
When pat opens the carrier picker
Then it offers only the cast of Villagers, with each person shown once, by first name and surname

### AC7: Carriers across several roles
Given "Lantern", quantity 2, is linked to Villagers (Jo Brown, Kim Lee, Alex Green) and Baker (Sam Taylor)
When pat chooses Jo Brown and Sam Taylor
Then the card shows Jo Brown next to Villagers and Sam Taylor next to Baker

### AC8: A card says how many are left to choose
Given "Lantern", quantity 3, is linked to Villagers (Jo Brown, Kim Lee, Alex Green and Ash Green), with only Jo Brown chosen
When anyone opens the props page
Then the card shows Jo Brown next to Villagers and says "2 left to choose"
And a prop saved with no carriers chosen says "3 left to choose"

### AC9: A role with no carriers says so
Given "Lantern", quantity 1, is linked to Villagers and Baker, carried by Sam Taylor
When the card is shown
Then Villagers shows that nobody in it carries the prop, and Baker shows Sam Taylor

### AC10: Editing changes the carriers
Given "Bread basket" is carried by Kim Lee
When pat edits it, removes Kim Lee, chooses Alex Green and saves
Then the card shows only Alex Green

### AC11: The API refuses a carrier outside the prop's roles
Given Sam Taylor plays Baker, and "Bread basket" is linked only to Villagers
When a request saves Bread basket carried by Sam Taylor
Then the response is 400, and nothing is saved

### AC12: The API refuses more carriers than the quantity
Given "Bread basket" has a quantity of 1
When a request saves it carried by Jo Brown and Kim Lee
Then the response is 400, and nothing is saved

### AC13: Without Stage, carriers can be seen but not chosen
Given "sam" has the Casting permission only
When sam opens Village Square's props page
Then the cards show their carriers and how many are left to choose, with no way to change them

## Notes

- FRs: FR26, FR27
- Depends on: production-props.E6.S1
- A prop stores its carriers as cast member ids, never names, as a role stores its cast (ADR 0010). The API checks each one is in the cast of one of the prop's roles, at save time.
- "Fits" means the people in the prop's roles, each counted once, are no more than its quantity. Then they all carry it and there's no picker (FR27).
- The picker works like the ensemble picker (searchable, keyboard), and is labelled. "Choose up to N" and the count left are announced as they change.
- Changing the roles or the quantity in the form updates the picker straight away. Carriers who are no longer in the chosen roles are taken off.
- Out of scope: what happens to carriers when casting changes later, and lowering the quantity below the carriers (E6.S3); the Word export (E6.S4).
