---
feature: production-props
status: approved
owner: Nick Hirst
date: 2026-10-25
---

# Production props: PRD

## Problem

The props team keeps each show's props list on paper or in Word. Every time casting or the running order changes, someone retypes the list by hand. Lists go out of date, so a prop ends up with the wrong person, or an item gets dropped. The props team can't see from the list who carries a prop, because the casting is in iCUE and the list isn't. The Props page in iCUE today only says "Coming soon".

Access doesn't fit the show's departments either. Every account has exactly one role: Admin, Casting Team Member or Read-Only Team Member. Giving the props team a casting account would let them change casting, and a read-only account wouldn't let them keep their list. One person often works across departments: a stage manager looks after the stage and the tech. A single role per person can't say that.

The Production menu lists every department's pages side by side (Mic plot, Props, Scenery, SFX). The show runs as separate Stage, Tech and Costume departments, so the menu doesn't show which department each page belongs to. Each new list adds another menu entry, so the menu grows longer.

## Users

| User | Need |
|---|---|
| Props team (stage manager, props master), with Stage permission | Keep each item's props list in one place, next to the running order, and know which character and which cast member uses each prop |
| Someone working across departments, e.g. a stage manager with Stage and Tech | Change what each of their departments needs, without a separate account per department |
| Casting team, with Casting permission | Carry on exactly as today, and see props without being able to change them |
| Read-Only Team Member (no permissions) | See everything, props included, without being able to change anything |
| Admin | Give each person exactly the departments they work in, without giving them casting access, and change props themselves |
| Anyone on the team, backstage | Print or share an up-to-date props list for the whole show |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| The props list is never retyped | Changes to casting or the running order that need the props list typing out again by hand | 0: the list and the export always show current casting and running order |
| Access matches the departments someone works in | Changes the API accepts outside an account's permissions, covered by tests for every change route and every permission | 0 |
| Nobody loses access in the change | Existing accounts that keep exactly their current access with no admin action | 100% |
| Admins set access quickly | Time for an admin to give an account a set of permissions, or change them | Under 1 minute |
| The show's props are visible at a glance | Clicks from the Props page to see how many props an item has, and its props notes | 0 (shown on the list) |
| Adding a prop is quick | Time to add a prop with a role to an item, starting on the item's props page | Under 30 seconds |
| A printable list on demand | Clicks from the Props page to a Word props list for the whole show | 1 |

## Non-goals

- **Building the Tech or Costume pages.** Mic plot, SFX, Scenery and anything for Costume stay "Coming soon" placeholders. Each will be its own feature, and will use its department's permission.
- **Permissions finer than a department**, such as "props but not scenery", or permissions that differ by production.
- **Changing what an Admin can do**, or what today's Casting Team Members can do.
- **Account management, Usage or other admin-only actions for anyone but admins.**
- **Prop details beyond a name and its roles**: quantities, sizes, sources, costs, photos, who is making it, checklists, or a note on each prop. A quantity can go in the name ("3 umbrellas").
- **Setting the order of props.** They're sorted alphabetically.
- **Changing the running order or casting from the props pages.**
- **Props that carry over between productions.** Each production's props are its own (CLAUDE.md).
- **Assigning a prop straight to a cast member.** A prop is linked to roles, and the cast member comes from the casting.
- **An Excel export of props.**

## Functional requirements

### Permissions
- **FR1**: Instead of one role each (team-roles FR1), an account is either an **Admin** or has any combination of four department permissions: **Casting**, **Stage**, **Tech** and **Costume**. An account with no permissions is a **Read-Only Team Member**.
- **FR2**: Each permission lets an account change one department's data, and nothing else:
  - **Casting**: what a Casting Team Member can change today. That's the cast, roles and casting, casting item notes, and the running order.
  - **Stage**: the Stage page's views. In this PRD that means props and props notes.
  - **Tech** and **Costume**: those pages and their views once each is built. Until then they let the account change nothing.
  - An Admin can change everything, as today, plus the admin-only actions.
- **FR3**: Everyone can read everything, whatever their permissions, as Read-Only Team Members do today (team-roles FR5). Pages show no controls that change data the account isn't permitted to change. Where a page has none, it shows a line saying what can be viewed but not changed, such as "You can view the casting, but not change it."
- **FR4**: The API refuses every change outside the account's permissions, however the request is made. Examples: a props change from an account without Stage, or a casting change from an account without Casting.
- **FR5**: Existing accounts keep exactly their access, with no admin action and without being signed out. Casting Team Members get Casting, Read-Only Team Members get no permissions, and Admins stay Admins.
- **FR6**: The Accounts page shows each account's permissions. When creating an account, and later, an admin chooses whether it's an Admin, or which of the four permissions it has, by ticking any combination. A new account starts with none, so a mistake gives the least access. Changing permissions asks the admin to confirm, saying what the person will be able to change. It takes effect as a role change does today (team-roles FR12), including the sign-out.
- **FR7**: Wherever the app names access, it uses the permission names. This includes the Accounts page, confirmations, and messages such as "Only admins can …".
- **FR8**: The rules that protect admin access still hold: there is always at least one enabled admin, and an admin can't change their own access (team-roles FR14).
- **FR9**: The "Local role" switch in local development and the demo lets you try Admin, or any combination of the four permissions, so each one's pages and refusals can be tried without an account (team-roles FR16).

### Menus
- **FR10**: The Production menu group stays, and its pages become three, one per department, with no further level of menu:
  - **Stage**, with a view switch between **Scenery** and **Props**;
  - **Tech**, with a view switch between **Mic plot** and **SFX**;
  - **Costume**, a "Coming soon" placeholder.

  The view switch looks and works like the Casting Overview's switch (By person, By item, Grid). Each page opens on its first view, as the Casting Overview does: Stage on Scenery, Tech on Mic plot. Views not yet built (Scenery, Mic plot, SFX) say "Coming soon". Every page and view is open to every role, as the Production pages are today.
- **FR11**: Old Production page addresses (such as a bookmark to Production → Props) open the department page they now belong to, on that view.
- **FR12**: The Welcome and Help pages describe the Stage, Tech and Costume pages, their views, and who can change what on each.

### The Props view
- **FR13**: The Stage page's **Props** view (called the Props page below) lists every item in the latest saved running order, in its halves and order, like the Casting Items page. Each row shows:
  - a first column headed **Props**, with a pencil button that opens the item's props page (a view button for those who can't change props, as on Casting Items);
  - the item's number, blank for items not in the printed programme;
  - its title, marked "Not in printed programme" where that applies, as on Casting Items;
  - the **number of props** the item has.

  There's no minutes column.
- **FR14**: An item's props notes (FR20) appear in full under its row on the Props page, as item notes do on Casting Items (casting-item-overview FR9). Items without props notes show nothing extra.
- **FR15**: If there is no saved running order, the Props page says so and points to the Running order page, as Casting Items does.

### An item's props page
- **FR16**: Each item has its own props page, with its own URL, showing the item's name and position in the running order. It offers a way back to the Props page, and **Previous** and **Next** links to the neighbouring items in running order, as the casting item page does. An item that isn't in the latest saved running order shows a "not found" message with a link back. An item with no props says that none have been added yet.
- **FR17**: An **Add prop** control, like Add role, lets anyone with Stage permission, or an Admin, add a prop with:
  - a name (required);
  - **none, one or many roles** from that item's casting, picked with a multi-select like the one for casting an ensemble.
- **FR18**: Each prop appears as a card showing its name and its roles. Next to each role is the name (first name and surname) of each cast member in it, or a clear "uncast" marker. The names always reflect current casting, so a recast role shows the new cast member without anyone editing the prop. A renamed role shows its new name. When a role is removed from the item, its props stay, without that role.
- **FR19**: Each prop card has a pencil button that edits its name and roles, and a trash can button that removes it after the user confirms. Neither shows for those who can't change props.
- **FR20**: Each item's props page has a **Props notes** section, which works like the casting item notes (casting-item-overview FR8 and FR10). It's free text, up to 500 characters, saved with the item so it survives new running-order versions. Clearing it removes it. A save is refused, showing the current notes, if someone else saved since the page loaded. Props notes are separate from the casting item notes and from the running order's Comments.
- **FR21**: Props are listed alphabetically by name, ignoring case, with numbers sorted by value ("Umbrella 2" before "Umbrella 10"), as roles are (casting-item-overview FR4). Roles on a card are in the item's role order.

### Export to Word
- **FR22**: The Props page has a **Generate Props List** button that downloads a Word props list for the whole show, for every role, Read-Only Team Members included. It follows the existing Word exports' conventions: a document built from what the page shows, a file named for the production and the date, and loading only when used.
- **FR23**: The document is laid out like the casting "By item" Word export: the production's title, then each half, then every item in running order as a headed section. That includes items not in the printed programme, marked as such, and items with no props, which say "No props". Under each item's heading are:
  - its props notes, if it has any;
  - a table with one row for each prop, showing the prop's name, each of its roles (character), and the cast member or members in each role, or "uncast". A prop with no roles leaves the role and cast columns empty.

## Non-functional requirements

- **Security and safeguarding**:
  - Permissions are enforced by the API on every change, not just by hiding controls (FR4). A change route can't skip the check: each says which permission it needs.
  - An account whose permissions can't be worked out gets no more than read-only access. A mistaken or unknown permission never grants more.
  - Permissions per department replace ADR 0020's single read-only rule for every route that isn't a `GET` (its "Revisit if"). They also change how a role is worked out from the sign-in groups. This needs a new ADR that supersedes or amends ADR 0020.
  - No new personal data about the cast or the team: permissions are all that's added to an account (ADR 0018).
  - The props pages and the export show cast members' first names and surnames only, never age band, section, group, or Singing or Acting notes (ADR 0010, ADR 0014, ADR 0022).
  - Props notes are free text, and could hold personal details. They're for the production team only, like the casting item notes.
  - The export is a copy of children's names outside the app's access control, as the casting exports are (ADR 0022).
  - Tests, fixtures and the demo use made-up props and names.
- **Accessibility**: WCAG 2.2 AA.
  - The permission tick boxes form a labelled group.
  - The pencil, view and trash can buttons have accessible names that include the item or prop.
  - The props count has a text label.
  - The role multi-select has a visible label and works by keyboard.
  - Props are a list, so screen readers announce how many there are.
  - Every page works at 320px and 360px with no sideways scrolling.
- **Performance**:
  - The Props page for a show of about 25 items loads in under 1 second.
  - An item with up to about 40 props loads in under 1 second.
  - The export for the whole show downloads in under 3 seconds on a phone.
  - Checking permissions adds no noticeable wait to any request.

## Constraints and assumptions

- **Items** come from the latest saved running order, by their stable IDs, numbered as on the Running order page. Unsaved running-order changes aren't shown.
- **Roles and cast names** come from the item's casting (casting-roles, cast-management). A prop links to roles, not to people.
- **One production** (2027). Props never carry over between productions, and permissions apply to the whole production.
- Builds on team-roles (ADR 0020): the same sign-in, the 5-minute delay before an access change takes effect, and the same Accounts page.
- 5 to 20 accounts. Most have one or two permissions.
- Cost stays close to £0, with no new AWS service.
- Deploys stay the maintainer's (CLAUDE.md). Any move of existing accounts happens as part of a deploy, not by an admin.
- **Assumption**: Scenery belongs to Stage, and Mic plot and SFX to Tech, both for the menu and for permissions.
- **App-wide pattern** (decided 2026-10-25): every page about one item has a link back to its list, and Previous and Next links to the neighbouring items in running order, as the casting item page does. The props page follows it (FR16), and so will any later item page (scenery, mic plot, SFX).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A change route gets the wrong permission, or none, so the wrong department can change it | M | H | Each change route names its permission in one place, and a route without one is refused. Test every change route with each permission and with none |
| Existing accounts lose or gain access when roles become permissions | M | H | FR5. Decide in the ADR how existing accounts move, test it before deploying, and run it with the deploy |
| A page still shows an editing control to someone without the permission | M | L | The API refuses the change anyway (FR4). Page tests check each page with and without the permission |
| Team members can't find their pages after the menu changes | M | L | Old addresses redirect (FR11), and Welcome and Help describe the department pages and their views (FR12) |
| A role linked to a prop is renamed or removed, so the prop shows a stale or broken role | M | M | Link props to roles by id, so renames follow. A removed role leaves the prop in place without it (FR18). Test both |
| An item leaves the running order, leaving its props behind | M (when running-order FR10 is built) | L | Same as casting-items' open question. Resolve before item removal is built |
| The props team prints the list, and then casting changes | M | L | The export always shows current casting. Its date is in the file name |
| Long role and cast name lists make prop cards long on a phone | L | L | Let names wrap, and check at 320px |

## Open questions

- Should the post-deploy check (`pnpm check:hosted`) confirm the department permissions? For example, a Stage-only account refused casting changes and allowed props changes. That needs another check account. Owner: maintainer.
- When an item is removed from the running order (running-order FR10, deferred), are its props and props notes deleted with it? Expected: yes. Owner: production team.

### Resolved

- A role linked to a prop is removed from the item: the prop stays, without that role (FR18). Decided 2026-10-25.
- The export button is called **Generate Props List** (FR22). Decided 2026-10-25.
- Usage: the visits recorded so far for the Mic plot, Props, Scenery and SFX placeholder pages are purged. From then on, visits are recorded under the Stage, Tech and Costume pages, and switching views as uses, as the Casting Overview's are. Decided 2026-10-25.
