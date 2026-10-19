---
feature: team-roles
status: approved
owner: Nick Hirst
date: 2026-10-18
---

# Team roles: PRD

## Problem

The app has two kinds of account: admins, and everyone else. The Accounts page calls everyone else a "Team member", and every team member can change casting: cast members, roles, item notes, and the running order as unsaved changes.

The creative team, such as the director and musical director, review casting decisions, but the casting team makes the changes. Today a reviewer has to be given a full team member account, which lets them change casting by accident or on purpose. The alternative is relying on screenshots and exports that go out of date. There is no way to give someone a look without the ability to edit.

"Team member" also no longer says what the role is for. Once there is a second kind of team member, it needs a clearer name.

## Users

| User | Need |
|---|---|
| Read-Only Team Member (creative team reviewer, e.g. director, musical director) | Sign in and see everything the casting team sees, including notes, clashes and the running order, on any page, without being able to change anything. |
| Casting Team Member (today's "Team member") | Carry on exactly as today, under a name that says what they do. |
| Admin | Give each person the right level of access when creating their account, and change it later, without the AWS console. |
| Maintainer | Confirm after a deploy that read-only accounts really can't change anything. |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Read-only means read-only | Changes the API accepts from a Read-Only Team Member, covered by tests and the post-deploy check | 0 |
| Reviewers see everything | Pages a Casting Team Member can open that a Read-Only Team Member can open and read in full | All of them |
| Nobody loses access in the change | Existing non-admin accounts that keep their current access with no admin action | 100% |
| Admins set access quickly | Time for an admin to create a read-only account, or change someone's role, in the app | Under 1 minute |
| Access changes bite quickly | Time from an admin changing a role, disabling an account or resetting its password until the API applies it to that person's requests on every device | Within 5 minutes |

## Non-goals

- **Changing what a Casting Team Member or an Admin can do.** Their permissions stay exactly as they are; only the Casting Team Member's name changes.
- **Access for anyone outside the production team**, such as parents or the public. Every role is still for the production team only (ADR 0010).
- **Custom or per-page permissions**, or roles that differ by production.
- **Account management for read-only members.** It stays admin-only. (Excel export was here too until ADR 0021 let every role export, 2026-10-19.)
- **Hiding particular data from reviewers.** Read-only members see the same data as the casting team, casting notes included.

## Functional requirements

### Roles
- **FR1**: Every account has exactly one of three roles: **Admin**, **Casting Team Member** or **Read-Only Team Member**.
- **FR2**: A Casting Team Member can do exactly what a non-admin team member can do today. Every existing non-admin account becomes a Casting Team Member without any admin action, and without being signed out.
- **FR3**: An Admin can do everything a Casting Team Member can, plus the admin-only actions, as today.
- **FR4**: Wherever the app names a role, it uses these three names. This includes the Accounts page, confirmations, and messages such as "Only admins can …".

### Read-only access
- **FR5**: A Read-Only Team Member can open every page a Casting Team Member can, and reads the same data. That covers the running order, the cast list with its casting notes, the items and each item's roles and notes, and the overview with its clashes and casting grid. Navigation, filters, view switches and Previous/Next between items work as they do for everyone.
- **FR6**: A Read-Only Team Member sees no controls that change data on any page. That means no add, edit, remove, move or drag, no notes editing, and no save or reset. A short visible line, such as "You have read-only access", explains why.
- **FR7**: The API refuses every change from a Read-Only Team Member, however the request is made. Only reading is allowed.
- **FR8**: A Read-Only Team Member can still sign in, choose a new password at first sign-in, stay signed in for a day and sign out, as every team member does today.

### Managing roles
- **FR9**: When an admin creates an account, they choose its role. Read-Only Team Member is the default, so a mistake gives the least access.
- **FR10**: The Accounts page shows each account's role. An admin can change it with a single choice of the three roles, which replaces today's Make admin and Remove admin.
- **FR11**: Changing a role asks the admin to confirm, saying what the person will be able to do.
- **FR12**: A role change takes effect on every device within 5 minutes. This matters most when someone moves to Read-Only Team Member, who must lose editing quickly. Until then the API keeps applying their old role. A role change signs the person out, so they sign back in to get the new one (amended 2026-10-18: the maintainer chose to keep the sign-out rather than have pages pick up the new role by themselves). A page that has a change refused as read-only says so and shows the read-only view.
- **FR13**: Disabling an account or resetting its password also ends that account's access on every device within 5 minutes, tightening hosting FR12 from 1 hour.
- **FR14**: There is always at least one enabled admin. An admin can't change their own role (hosting FR13).

### Maintainer
- **FR15**: The post-deploy check also confirms that a read-only account is refused every change. The maintainer can set up the check's read-only account from the repository, as with the check's existing accounts. The check prints no cast data.
- **FR16**: Local development and the demo keep working with no sign-in. They start as an admin (hosting FR18), and offer a visible switch between the three roles, so every role's pages and refusals can be tried without an account. The switch never appears in the hosted app.

## Non-functional requirements

- **Security**:
  - Read-only is enforced by the API on every change, not just by hiding controls.
  - An account whose role can't be worked out gets no more than read-only access. It must never fall back to casting or admin access.
  - No new personal data about the team: a role is all that's added to an account (ADR 0018).
  - Roles change the existing access-control decision, so they need an ADR amending ADR 0018.
- **Accessibility**: WCAG 2.2 AA.
  - The role choice has a visible label.
  - The read-only line is text, not colour or an icon alone, and is visible on phones without hover.
  - Pages without their editing controls still read in a sensible order with a screen reader.
- **Performance**: A Read-Only Team Member's pages load as quickly as a Casting Team Member's. Shorter sign-in lifetimes (FR12, FR13) add no noticeable wait: people stay signed in for the day without being asked again.

## Constraints and assumptions

- Builds on the hosted app's sign-in and admin group (hosting PRD, ADR 0018). Cost stays close to £0.
- 5 to 20 accounts, of which a few are read-only reviewers.
- Read-only members are adults on the production team, like every other account.
- One production (2027). A role applies to everything in it.
- Deploys stay the maintainer's (CLAUDE.md). Moving existing accounts to Casting Team Member happens as part of a deploy, not by an admin.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A change route is missed, so read-only members can still change something | M | H | Mark change routes centrally so a new one can't skip the check, test every route as a read-only member, and add the post-deploy check (FR7, FR15) |
| Existing team members are treated as read-only, or as admins, after the change | M | H | FR2 and the security NFR: decide in the ADR how existing accounts keep casting access while unknown roles fail safe, and test it before deploying |
| A page still shows an editing control to read-only members | M | L | The API refuses the change anyway (FR7). Page tests check each page as a read-only member (FR6) |
| Shorter sign-in lifetimes for FR12 and FR13 cause unexpected sign-outs or failed requests while a sign-in is renewed | L | M | Pages already renew sign-ins before they expire. Test renewal at the new lifetime, and confirm it in the post-deploy check and by hand after the first deploy |
| Reviewers aren't sure whether they're seeing the latest casting | L | M | Read-only members see the same live data as the casting team. The read-only line says only that they can't edit |

## Open questions

- None.
