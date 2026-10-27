---
id: production-props.E6.S3
title: Carriers follow the casting
epic: E6
status: done
---

## Story

As someone on the props team, I want a prop's carriers to keep up with recasting, so that the list never gives a prop to someone who's no longer in the part.

## Acceptance criteria

### AC1: A recast carrier drops off
Given "Bread basket", quantity 1, is linked to Villagers and carried by Kim Lee
When the casting team takes Kim Lee out of Villagers and pat reloads the props page
Then the card no longer shows Kim Lee, and says "1 left to choose"

### AC2: A carrier removed from the cast drops off
Given "Bread basket" is carried by Kim Lee
When Kim Lee is deleted from the cast
Then the card no longer shows Kim Lee, and says "1 left to choose"

### AC3: Taking a role off a prop drops its carriers
Given "Lantern", quantity 2, is linked to Villagers and Baker, carried by Jo Brown (Villagers) and Sam Taylor (Baker)
When pat edits Lantern and takes Baker off
Then the form no longer has Sam Taylor chosen, and once saved the card shows Jo Brown and "1 left to choose"

### AC4: A role removed from the item drops its carriers
Given "Lantern" is carried by Sam Taylor, who plays Baker
When the casting team removes the role Baker from Village Square
Then Lantern's card no longer shows Sam Taylor, and says one more is to choose

### AC5: Once the cast fits, nobody needs choosing
Given "Bread basket", quantity 1, is linked to Villagers (Jo Brown and Kim Lee), with nobody chosen
When the casting team takes Jo Brown out of Villagers
Then the card shows Kim Lee carrying it, with nothing left to choose

### AC6: The quantity can't go below the carriers
Given "Lantern", quantity 3, is carried by Jo Brown, Kim Lee and Alex Green
When pat edits it and lowers the quantity to 2
Then it isn't saved, and the form says to remove a carrier from Selected carriers first

### AC7: The API refuses a quantity below the carriers
Given "Lantern" is carried by three people
When a request saves it with a quantity of 2 and the same three carriers
Then the response is 400, and nothing is saved

### AC8: A carrier who comes back isn't chosen again
Given Kim Lee carried "Bread basket" and was taken out of Villagers
When the casting team puts Kim Lee back in Villagers
Then the card doesn't show Kim Lee as a carrier until someone chooses them again

### AC9: Named parts always carry it
Given "Lantern", quantity 2, is linked to Baker (Sam Taylor) and Villagers (Jo Brown, Kim Lee and Alex Green)
When pat adds it
Then the carrier picker offers only Jo Brown, Kim Lee and Alex Green, saying "Choose up to 1"
And once Kim Lee is chosen and it's saved, the card shows Sam Taylor next to Baker and Kim Lee next to Villagers

### AC10: Named parts alone need no choosing
Given Knots and Crosses has the roles Referee, Captain Cross and Captain Nought, one person each
When pat adds "Whistle", quantity 3, linked to all three
Then the form offers no carrier picker, and the card shows all three carrying it

### AC11: The quantity can't go below the named parts
Given the same three roles
When pat adds "Whistle", quantity 2, linked to all three
Then it isn't saved, and the form says the quantity must be at least 3

### AC12: The API keeps to the named parts
Given "Lantern" is linked to Baker (Sam Taylor) and Villagers
When a request saves it with a quantity of 2 and Sam Taylor chosen as a carrier, or with a quantity of 2 linked to three named parts
Then the response is 400, and nothing is saved

## Notes

- FRs: FR28, and FR26 and FR27 changed by AC9 to AC12 (found while demoing: choosing among the people in named parts made no sense, as each always carries the prop)
- Depends on: production-props.E6.S2
- A carrier who leaves the prop's roles is dropped from the prop when it's next saved, or by the casting change itself, whichever is simpler. Either way, AC8 holds: a carrier never comes back on their own, so a stored id can't linger.
- Deleting someone from the cast removes them from every prop, as it removes them from every role (ADR 0010).
- Out of scope: the Word export (E6.S4).
- Follow-up: a dropped item's props keep their carrier ids, as whether those props are kept at all is still an open question in the PRD.
- A carrier saved before AC9 who plays a named part stays in the stored ids, harmlessly: they carry it anyway, and the next edit saves only the ensemble carriers.
- A casting change can leave more named parts than the quantity (an uncast role is cast). The card then shows them all with nothing to choose; the next edit asks for a higher quantity.
- "N left to choose" on a card is bold red italic, as "Nobody carries it" is, so a prop still needing carriers stands out (asked for while demoing).
