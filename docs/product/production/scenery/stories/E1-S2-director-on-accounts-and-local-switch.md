---
id: production-scenery.E1.S2
title: Choose Director on the Accounts page and the local switch
epic: E1
status: done
---

## Story

As an admin, I want to give the show's director the Director permission from the Accounts page, so that they can work across every production department without me making them an Admin.

## Acceptance criteria

### AC1: Each account shows Director
Given "dee" has Director, and "kim" has Stage and Director
When an admin opens the Accounts page
Then dee shows "Director" and kim shows "Stage, Director"

### AC2: An admin gives an account Director, confirming first
Given "pat" has Stage
When an admin ticks Director for pat and saves
Then they're asked to confirm, in words that say pat will be able to change every production department's pages, but not the casting or the show
And it says pat will be signed out on every device
And when they confirm, pat shows "Stage, Director"

### AC3: A new account can have Director
Given an admin creating an account
When they tick Director and create it
Then the new account has the Director permission

### AC4: Removing Director
Given "dee" has Director only
When an admin unticks Director and confirms
Then the confirmation says dee will only be able to view the show
And dee shows "Read-only"

### AC5: Admin still can't be combined with Director
Given an admin making "dee" an Admin
When they choose Admin
Then the Director tick box can't be ticked alongside it, as for the other permissions
And the API refuses a request giving one account Admin and Director together

### AC6: The local switch offers Director
Given `pnpm demo` is running
When I switch to Director only
Then the props pages show their controls and the casting pages show the read-only view
And the local API saves my props changes and refuses my casting changes

### AC7: The read-only lines name Director
Given "jo" has no permissions
When jo opens a props list
Then the read-only line or its help says who can change the props: "Accounts with Stage or Director, and admins"

## Notes

- FRs: FR1, FR3
- Depends on: production-scenery.E1.S1
- The tick box sits with Casting, Stage, Tech and Wardrobe, in that order with Director last.
- Check where the app names who can change what (the read-only lines, Help's permission list, the Accounts confirmations) and add Director wherever the other permissions are named. That includes Help's lines for each department page on the Production overview (Scenery, SFX, Mic plot and Wardrobe as well as Props) and Welcome's list of department permissions. Help's fuller description of Director comes in E3.S1.
- Out of scope: scenery's own read-only line (E2.S1).
- From E1.S1's UX review: until this story, `AccessChoice` hides Director, so an account (or local role) with only Director shows every box empty and no read-only line, though it isn't read-only. Showing the tick box fixes that. The access confirmation must name the pages Director changes ("the Scenery, Props, SFX, Mic plot and Wardrobe pages"), not "the Director page", which `whatTheyCanChange` in `apps/web/src/utils/accounts.ts` would say today.
