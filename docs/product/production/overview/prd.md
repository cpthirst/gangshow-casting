---
feature: production-overview
status: approved
owner: Nick Hirst
date: 2026-10-26
---

# Production overview: PRD

## Problem

Production has three pages, one per department: Stage (with a Scenery / Props switch), Tech (Mic plot / SFX) and Costume (production-props FR10). Each list view repeats the show's running order: today the Props view does, and Scenery, Mic plot and SFX would each add another copy as they're built. Five lists of the same items, each behind a page and a switch, means more clicks for the team and more pages for the maintainer to build and keep in step. Someone who works across departments, such as a stage manager with Stage and Tech, has to hop between pages to see one item's needs.

The show calls the department **Wardrobe**, not Costume. The app's name for it doesn't match the word the team uses.

## Users

| User | Need |
|---|---|
| Department teams (Stage, Tech, Wardrobe) | Find an item and open their department's page for it in one click, from one list of the show |
| Someone working across departments, e.g. a stage manager with Stage and Tech | See and open every department's page for an item from the same row |
| Casting team and Read-Only Team Members | View every department's pages for any item without being able to change them |
| Admin | Give the Wardrobe permission under the name the show uses |
| Anyone on the team, backstage | Generate each department's printable list from the same page |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| One list of the show for Production | Lists of the running order under Production | 1 (the Overview) |
| Any department's page for an item is quick to reach | Clicks from the Overview to a department's page for an item | 1 |
| A short menu | Pages under Production in the menu | 1 |
| The app uses the show's words | Places in the app (pages, messages, Accounts, the local switch, Help) that say "Costume" | 0 |
| Nobody's access changes, other than as agreed | Accounts whose permissions change in the move, other than any Costume ticks dropped by the rename (see Constraints) | 0 |
| Printable lists stay one click away | Clicks from the Overview to the Word props list | 1 |

## Non-goals

- **Building Scenery, SFX, Mic plot or Wardrobe.** Their item pages say "Coming soon". Each will be its own feature, and adds its own count or export if it needs one.
- **The Mic Plot (Excel) and SFX List (Word) exports.** They arrive with the Mic plot and SFX features, beside Generate Props List.
- **Count columns other than Props.** Each later feature decides whether to add a count, and what it counts.
- **Changing permissions** beyond renaming Costume to Wardrobe: no new departments, and nothing finer than a department.
- **Changing the props item page**, other than where its back link goes.
- **Casting on the Overview.** Casting keeps its own pages.
- **Changing the running order from the Overview.**
- **Moving existing Costume permissions across to Wardrobe.** The maintainer confirmed no account relies on it (Costume lets an account change nothing today).

## Functional requirements

### Wardrobe
- **FR1**: The **Costume** department and permission become **Wardrobe** everywhere: the Accounts page's tick boxes and confirmations, the "Local role" switch in local development and the demo, refusals and read-only lines, the Welcome and Help pages, and the names the API and sign-in use for the permission.
- **FR2**: The Wardrobe permission works as Costume did (production-props FR2): it lets an account change Wardrobe's pages once they're built, and nothing else until then.

### The Overview
- **FR3**: Production's menu group has one page, **Overview**, replacing Stage, Tech and Costume. There's no further level of menu. Every role can open it.
- **FR4**: The Overview lists every item in the latest saved running order, in its halves and order, like the Casting Items page. Each row shows:
  - the item's number, blank for items not in the printed programme;
  - its title, marked "Not in printed programme" where that applies;
  - one square button for each department page, in this order: **Scenery**, **Props**, **SFX**, **Mic plot**, **Wardrobe**, each with its own icon;
  - the **number of props** the item has, in a column headed Props.

  There's no minutes column. There are no view switches (pills) on the page.
- **FR5**: Each square button opens that department's page for the item. Every role can open every one. Someone with that department's permission (or an Admin) can make changes there, and anyone else sees it read-only, with the line saying what can be viewed but not changed (production-props FR3). Each button's accessible name says what it opens, for which item, and whether it is to edit or to view (for example "Edit props for Opening Number").
- **FR6**: An item's props notes appear in full under its row, labelled as props notes, as on today's Props view (production-props FR14). Items without props notes show nothing extra.
- **FR7**: If there's no saved running order, the Overview says so and points to the Running order page, as Casting Items does.
- **FR8**: The Overview has a **Generate Props List** button that works as it does today (production-props FR22, FR23). Later exports (Mic Plot in Excel, SFX List in Word) sit beside it when their features are built.

### Each item's department pages
- **FR9**: The props item page's link back goes to the Overview. Its Previous and Next links are unchanged.
- **FR10**: Scenery, SFX, Mic plot and Wardrobe each have a page per item, with its own address. Each shows the item's name and position in the running order, a link back to the Overview, and Previous and Next links to the neighbouring items, as every item page does (CLAUDE.md). Until its feature is built, each says "Coming soon". An item that isn't in the latest saved running order shows a "not found" message with a link back.

### Addresses, help and usage
- **FR11**: Old addresses open the Overview: the Stage, Tech and Costume pages with any of their views, and the older Production addresses (production-props FR11). Bookmarks to an item's props page still open it.
- **FR12**: The Welcome and Help pages describe the Overview, what each button opens, the Generate Props List button, and that each department's permission (Stage, Tech, Wardrobe) is what lets someone change its pages.
- **FR13**: The Usage page records visits to the Overview as a menu page, and uses of Generate Props List as today. The Stage, Tech and Costume pages and their views are no longer recorded (their past visits are purged once after the deploy; see Open questions → Resolved).

## Non-functional requirements

- **Security and safeguarding**:
  - The API keeps refusing every change outside the account's permissions (production-props FR4). Renaming the permission must never widen anyone's access. An unknown or old permission name, including `costume`, grants nothing.
  - Renaming the department's sign-in group is a change to the AWS sign-in setup. It needs a decision record amending ADR 0026, and the infra review.
  - No new personal data. The Overview shows no cast names, and the item pages show only what their features already show.
- **Accessibility**: WCAG 2.2 AA.
  - The square buttons are icon-only, so each has an accessible name (FR5) and a visible tooltip or label on focus and hover. Icons are decorative to screen readers.
  - Buttons are at least 24 by 24 CSS pixels (target 44 by 44 where the row allows), and work by keyboard in a sensible order.
  - The props count has a text label.
  - The Overview and every item page work at 320px and 360px with no sideways scrolling, five buttons included.
- **Performance**: The Overview for a show of about 25 items loads in under 1 second, as the Props view does today.

## Constraints and assumptions

- Builds on production-props: its permissions, its props pages and its Word export. Items come from the latest saved running order, by their stable IDs, numbered as on the Running order page.
- **Wardrobe rename, decided 2026-10-26**: the maintainer confirmed no real account relies on the Costume permission, so it is renamed in one release. Any account that did have Costume ticked would lose it and need Wardrobe ticking. No move command is needed.
- **Departments**: Scenery and Props belong to Stage, SFX and Mic plot to Tech, and Wardrobe to Wardrobe, for permissions (production-props assumption).
- **Icons**: from the Font Awesome set the app already uses (ADR 0013). Chosen 2026-10-27: Scenery a hammer, Props a person walking with luggage, SFX an audio file, Mic plot a microphone, Wardrobe a shirt.
- One production (2027), and cost stays close to £0 with no new AWS service.
- Deploys stay the maintainer's (CLAUDE.md).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Renaming the group drops someone's Costume tick unnoticed | L | L | Maintainer confirmed no-one relies on it, and Costume grants nothing today. The release notes say so |
| The rename leaves `costume` granting access somewhere, or Wardrobe granting none | L | M | Tests for every change route with each permission and with none (production-props pattern), and `costume` tested as unknown |
| Five buttons and a count don't fit a row at 320px | M | M | Square icon buttons, the title allowed to wrap, and the browser layout tests at 320px and 360px |
| Icon-only buttons are unclear to non-technical volunteers | M | M | Tooltips, accessible names, a legend or Help text naming each icon. Check in the UX review |
| Team members can't find their pages after the menu changes | M | L | Old addresses redirect (FR11), and Welcome and Help describe the Overview (FR12) |

## Open questions

None open.

### Resolved

- Usage: the visits recorded for the Stage, Tech and Costume pages and their views are purged once, by hand, after the deploy, with no repeatable command; the existing `pnpm usage purge` is removed (production-overview.E3.S2). Decided 2026-10-27.
- No icon legend on the Overview: each button has a tooltip and an accessible name, and Help names every icon (production-overview.E2.S2, E3.S1). Revisit if the team find the icons unclear. Decided 2026-10-26.
