---
id: production-overview.E1.S1
title: Call the Costume department Wardrobe
epic: E1
status: ready
---

## Story

As an admin, I want the Costume department and permission called Wardrobe, as the show calls it, so that the team recognises their department and I give the right permission first time.

## Acceptance criteria

### AC1: The Accounts page offers Wardrobe
Given an admin on the Accounts page
When they look at an account's permissions, change them, or create an account
Then the tick boxes are Casting, Stage, Tech and Wardrobe, in that order
And there is no Costume tick box

### AC2: The confirmation names Wardrobe
Given an admin ticks Wardrobe for "sam"
When they confirm the change
Then the confirmation says sam will be able to change Wardrobe
And afterwards sam's account shows Wardrobe

### AC3: A new account can be given Wardrobe
Given an admin creating the account "alex" with only Wardrobe ticked
When the account is created
Then alex's account shows Wardrobe and no other permission

### AC4: Wardrobe changes nothing else
Given "sam" has only Wardrobe
When sam tries to change the casting, the running order or a prop, however the request is made
Then each change is refused, as for an account with no permissions

### AC5: The old Costume permission grants nothing
Given a sign-in that still carries the old Costume group
When it asks to change anything
Then the change is refused, as for an account with no permissions
And the Accounts page doesn't show Costume for it

### AC6: The local switch offers Wardrobe
Given someone running the app in local development or the demo
When they open the "Local role" switch
Then they can choose Admin, or any combination of Casting, Stage, Tech and Wardrobe
And there is no Costume choice

### AC7: The Production page is called Wardrobe
Given anyone signed in
When they open the menu
Then Production shows Stage, Tech and Wardrobe
And Wardrobe opens a page titled Wardrobe that says "Coming soon"
And an old link to the Costume page opens the Wardrobe page

### AC8: Help and Welcome say Wardrobe
Given someone reads the Welcome page or the Help page
When they read about Production and permissions
Then they read Wardrobe, with what it lets someone change
And nowhere says Costume

### AC9: Usage shows Wardrobe
Given visits to the Costume page recorded before the change, and visits to Wardrobe after it
When an admin opens the Usage page
Then the page is listed as Wardrobe, with all its visits
And nowhere says Costume

## Notes

- FRs: FR1, FR2
- Depends on: none
- **ADR**: renaming the department's sign-in group amends ADR 0026. Record it with the `adr` skill: `wardrobe` replaces `costume` in one release, with no move command, because the maintainer confirmed no account relies on Costume (PRD constraints, decided 2026-10-26). Anyone who did have it would need Wardrobe ticking. `infra-reviewer` runs, since the user pool's groups change.
- After the deploy, a token can still carry `costume` for up to 5 minutes. AC5 makes that harmless.
- AC9: the Usage page's name for the page can keep its stored form, if that's what keeps past visits counting. What matters is that it reads Wardrobe. The page itself goes in E2.S1.
- `clashes.ts` uses "costume" in the sense of a costume change. That isn't the department, so it stays.
- Out of scope: the Overview (E2.S1), and moving anyone's Costume tick across.
