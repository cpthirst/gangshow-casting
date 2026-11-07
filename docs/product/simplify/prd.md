---
feature: simplify
status: approved
owner: Nick Hirst
date: 2026-11-07
---

# Simplify: PRD

## Problem

iCUE grew one feature at a time, and some parts were built again for each feature instead of being shared. That costs the team and the next maintainer in four ways. A consultant's review of the code (the `consult` skill, 2026-11-07) found the evidence:

- **A department is described by hand in about ten places.** These include its name, its permissions, its read-only line, its notes and its clean-up when an item is cut. Adding the last department touched 82 files. A missed piece is live today: **when an item is cut from the show, its scenery notes are left behind**, against scenery FR13. Props and props notes are left behind on purpose, pending the props PRD's open question. Which department a refusal names depends on the order its permissions are listed in. That rule (ADR 0029) has already needed two patches.
- **Each page about one item is built separately.** Casting, Props, the Mic plot and the file departments repeat the same frame four times, and the copies have drifted apart:
  - Casting's title is the bare item name, where the others say "Props: Pirate Sketch".
  - Its notes heading is "Notes", where the others name their department.
  - Props visits aren't recorded, so the Usage page can't show who uses Props.
- **Lines of text explain what the layout should show.** Three pages carry a tagline that repeats their Help summary. Eight pages carry a sentence saying who can change them. Disabled buttons carry a line explaining why. Every notes box says "Up to 500 characters". On a phone mid-rehearsal, that pushes the volunteer's data down the screen.
- **Shared pieces are named after the first page that used them.** A card is `.role-card` and a button row `.cast-actions`, in six files each. Loading from the API is written out 30 times. The production id "2027" is hard-coded in 7 places.

There is also a new need. **Another production is coming soon**, and the app can only show one. It has no way to start a new production, switch to an old one, or remove a past one whose cast were mostly children.

## Users

| User | Need |
|---|---|
| Department teams (Stage, Tech, Wardrobe) and the casting team | Every item page reads the same way; their data, not explanations, fills the screen |
| Viewers with read-only access, e.g. the director | See at a glance that a page is view only; find who can change it in Help |
| Admin | Start the next production, see who uses every department, and delete a past production when it's no longer needed |
| Anyone on the team | Open the newest production by default, and look back at an older one |
| The maintainer, and the coding agents that work for them | Add or change a department, an item page or a data call in one obvious place |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| A department is described once | Places that list each department's name, permissions or wording | 1 (today about 10) |
| Nothing about a cut item lingers | Scenery notes, props or props notes left for an item cut after release | 0 |
| Refusals don't depend on permission order | Route-specific refusal patches | 0 (today 2) |
| Item pages share one frame | Separate implementations of the item page frame | 1 (today 4) |
| Every department's use is visible | Departments missing from the Usage page | 0 (today Props) |
| The layout explains itself | Page taglines; read-only sentences on pages; always-on notes limit lines | 0; 0 (today 8); 0 |
| One way to load data | Hand-written API loading checks in the web app | 0 (today 30), through one shared way |
| Shared pieces have purpose names | Style classes named after another page, reused elsewhere | 0 (today 5) |
| More than one production | Productions the app can hold, start, switch between and delete | Any number; places with a hard-coded production id: 0 (today 7) |

## Non-goals

- **Rebuilding or restyling pages that work.** Changes are limited to what the requirements below name.
- **Removing past leftovers.** Scenery notes, props and props notes of items cut before this ships stay where they are. Only cuts from now on remove them.
- **Changing what the API returns, except where an FR says so.** Refusal wording stays exactly the same.
- **Merging Casting into the Production overview.** The production-overview PRD keeps Casting's own pages.
- **Replacing the browser's own confirm dialogs, or splitting the long Accounts and Running order pages.**
- **A general-purpose "department" handler on the API.** Item notes and item files are already shared, and plain handlers stay (ADR 0006).
- **Carrying anything over between productions.** No cast, items, running order or casting is copied. A new production starts empty.
- **Looking across productions.** One production is shown at a time, and nothing compares or reports across them.
- **Changing past productions.** Once a newer one exists, an older one can be viewed but not changed.
- **Changing the Help or Welcome pages' purpose.** They gain the access details the pages lose (FR13), and nothing else is removed.

## Functional requirements

### Epic 1: One list of departments
- **FR1**: When an item is cut from the running order and the order is saved, its scenery notes, props and props notes are deleted with it, as its casting, files and mics already are. Reset on the Running order page still undoes a cut before it's saved.
- **FR2**: Each department's name, the permissions that let an account change it, and the line naming who can change it are stated once. Every page, menu, notice, Help entry, Usage label and refusal uses that one statement.
- **FR3**: A refusal names the department the route belongs to, whatever order its permissions are listed in. Every refusal's wording stays exactly as it is today.
- **FR4**: The app tells a read-only refusal apart from other failures without depending on the refusal's wording.
- **FR5**: Every kind of data kept per item is removed when the item is cut. Adding a new kind can't leave it out unnoticed.

### Epic 2: One frame for every item page
- **FR6**: Every page about one item (Casting, Props, Scenery, SFX, Wardrobe, Mic plot) shares one frame:
  - a link back to its list, and Previous and Next links;
  - a title in the form "Department: Item", e.g. "Casting: Pirate Sketch";
  - the item's position in the running order;
  - its notes, headed with the department's name, e.g. "Casting notes";
  - the same "Item not found" and error states.
- **FR7**: Visiting a Props item page is recorded like the other departments' visits, and Props appears on the Usage page.
- **FR8**: Each item page keeps everything it does today inside the frame. Nothing is lost in the move.

### Epic 3: Let the layout do the explaining
- **FR9**: The taglines under Casting Items, the Casting overview and the Production overview are removed. Each page's purpose stays in its Help summary.
- **FR10**: A page the person can only view shows a compact "View only" badge by its title, replacing today's read-only sentence. It still meets team-roles FR6's "short visible line". A refusal after an attempted change still shows as an alert (team-roles FR12).
- **FR11**: A notes box shows how many characters are left only once fewer than 50 remain.
- **FR12**: A control that can never work for this person is not shown, rather than shown disabled with a line explaining why. One example is an admin's access and Disable buttons for their own account.
- **FR13**: Each page's Help says who can change the page, from FR2's one statement.
- **FR14**: When several things fail to load on the Production overview, it shows one alert naming them, not one alert each.
- **FR15**: The running order's draft number is worded the same way on every page that shows it.

### Epic 4: Name shared pieces for what they are
- **FR16**: The shared look for cards, button rows, forms, tables and the Open column has names that say what each one is. No page borrows another page's name for it.
- **FR17**: The web app loads data from the API in one shared way, with one rule for failures and one for "nothing there yet". It moves over item pages first, alongside Epic 2.
- **FR18**: The web app takes the production it's showing from one place, never from a hard-coded id.

### Epic 5: More than one production
- **FR19**: An admin can start a new production, named by its year (e.g. "2028"). It starts empty: no cast, items, running order, casting, props, files, mics or notes.
- **FR20**: Everyone opens the newest production by default, and can switch to an older one. The page always shows which production is open.
- **FR21**: A production older than the newest can be viewed but not changed by anyone, admins included. Its pages show "View only" (FR10), and its exports still work.
- **FR22**: An admin can delete a past production for good, after a confirmation that names it. Everything held for it goes: cast, running orders, casting, props, files, mics, notes and its usage records. The newest production can't be deleted.
- **FR23**: Team accounts and their permissions apply to every production. Starting, switching or deleting a production changes nobody's access.

## Non-functional requirements

- **Security**:
  - Every new route requires sign-in, as every route does now (ADR 0018).
  - Starting and deleting a production are admin-only, in the API as well as the pages.
  - The API refuses any change to a past production, whatever the page shows.
  - No personal data beyond ADR 0010 and 0014 is added.
- **Privacy (UK GDPR)**: deleting a production deletes its children's data permanently, except for the backup window ADR 0015 records. The admin is told about that window before confirming.
- **Accessibility**: WCAG 2.2 AA. The "View only" badge is announced to screen readers, not shown by colour alone. Hiding controls (FR12) never hides the only route to a task. The production switch works by keyboard.
- **Performance**: no page gets slower. Switching productions shows the chosen production's data in the time a page load takes today.
- **Phones**: every changed page passes the browser layout walks at 320px and 360px.
- **Releasable throughout**: each story ships on its own behind `pnpm check`, the browser layout tests and the database tests, with `main` releasable between stories.

## Constraints and assumptions

- **ADR 0029 is amended first.** A short ADR, written with the `adr` skill, replaces its refusal clause ("refusals use the line of the first permission a route names") with a per-department line. It must be accepted before FR3's story starts.
- **Epic 5 needs ADRs before its stories.** They cover how the list of productions is held, and how a production's files and data are deleted, including the files bucket (ADR 0030, 0032) and the backup window (ADR 0015). Every API route is already scoped to a production, so no route has to change shape.
- **Order of work:** Epic 1's bug fix (FR1) ships first. Epic 4's data-loading story ships alongside Epic 2's page moves, and its renames come after Epic 2, so item pages are only reworked once. Epic 4's single production id (FR18) comes before Epic 5.
- **Domain rules stand:** each production is self-contained, casting is per item, the running order matters, and each item page links back to its list and to its neighbours (CLAUDE.md).
- **Assumption:** volunteers rarely approach the 500-character notes limit (confirmed by the maintainer).
- **Assumption:** nobody has relied on an item's scenery notes surviving a cut (confirmed by the maintainer).
- This is five epics where the break allowed for three or four. Epic 5 was added at the maintainer's request because another production is coming soon.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A refusal's wording changes while moving it into the department list, breaking read-only detection | M | M | Tests pin every refusal string before the move (FR3, FR4) |
| Cutting an item now deletes props someone wanted to keep | L | M | The maintainer confirmed the behaviour. The release notes say so, and Reset undoes a cut before saving |
| Merging four item-page frames drops a behaviour one page had | M | M | Move one page per story. Each page's existing tests stay until the frame's tests cover the behaviour (FR8) |
| Hiding explanations leaves a volunteer unsure why they can't change something | M | L | The "View only" badge, plus who can change it in Help (FR10, FR13) |
| Deleting the wrong production | L | H | Admin-only. The confirmation names the production, and the newest can't be deleted (FR22) |
| Epic 5 outgrows the break | M | M | It goes last. Its ADRs come first, and the other epics don't depend on it |

## Open questions

- Should an admin be able to make a past production changeable again, for example to fix a mistake found after the show? Owner: maintainer.
- Should deleting a production remove its usage records, or keep them until their own 90-day expiry (ADR 0023)? This PRD assumes they're removed. Owner: maintainer.
- How should a production be named in the switch: by year alone, or by year and title (e.g. "2028: Gang Show")? Owner: maintainer.
