---
feature: remote-data
status: approved
owner: cpthirst
date: 2026-10-17
---

# Remote data: PRD

## Problem

All of the production's data, including the cast list, roles, item notes and every running-order version, lives in files on one laptop. If that laptop is lost, broken or wiped, the 2027 show's casting is gone, and there is no backup. Nobody else can run the app against the same data. Before the app can ever be shared with the team, the data needs a managed home in the cloud (ADR 0015). Moving it also has to be safe: the local files are the only copy today, so they must not be deleted until the cloud copy has been proven to come back through the app.

## Users

| User | Need |
|---|---|
| Production team (through the app) | Their casting work survives the loss of a laptop, and the app behaves exactly as before. |
| Maintainer (the person running the app and deploying) | Set up the cloud database from code, move the existing data across once, prove it arrived intact, and only then remove the local files. |
| Developers and CI | Test the cloud data layer without touching AWS or real data. |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| The data survives the loss of the laptop | Production data held outside the laptop, with point-in-time recovery | 100% of the 2027 production's data, recoverable to any point in the last 7 days |
| Moving the data loses nothing | Each API read (cast, roles, item notes, latest running order, every running-order version) compared between the local files and the remote database | Identical for every read before any local file is deleted |
| The app behaves the same | Existing API and web test suites pass against the new data layer's behaviour; the user-visible pages are unchanged | All pass; no user-facing change |
| Concurrent edits stay safe | Stale-revision, version-conflict, unique-role-name and "delete also uncasts" rules hold against the remote database | Every rule covered by a test against a local database emulator in CI |
| It costs next to nothing | Monthly AWS bill for the data store at the team's usage | Under £1 a month, and nothing when idle |

## Non-goals

- **Hosting the API or the web app.** The API keeps running on the maintainer's machine; only the data moves. Hosting needs a sign-in and access-control decision first (ADR 0010).
- **Sign-in, user accounts or access control** in the app.
- **Deploying from CI.** Deploys are run by hand from the maintainer's machine for now.
- **A dev or staging copy in AWS.** One remote database, for the real production. Development and tests use local files or the emulator.
- **Changing the API contract, the pages or the shared schemas.**
- **Queries across productions, reporting or exports.**
- **Moving the demo show or the browser-test data.** They stay as local made-up files.

## Functional requirements

- **FR1**: The cloud resources the data needs (the database, and its backup setting) are defined in the repository's infrastructure code and can be deployed and torn down from it.
- **FR2**: Point-in-time recovery keeps 7 days of history, so data deleted in the app, such as a cast member who has left, is gone from every copy within 7 days. There is no privacy notice, so ADR 0010's "deletion is permanent" is updated to record the 7-day window.
- **FR3**: Deleting the infrastructure stack never deletes the production data by accident; removing the data store is a separate, deliberate step.
- **FR13**: The infrastructure code includes a monthly budget alert that emails the maintainer when the account's AWS spend is forecast to pass £5 a month.
- **FR4**: The API can keep the production's data in either the local files or the remote database, chosen by configuration when it starts. Without that configuration it uses the local files, as today.
- **FR5**: Against the remote database, the API supports everything it does today: listing, adding, editing and deleting cast members; listing, adding, editing and removing roles; reading and saving item notes; reading the latest running order and saving a new version.
- **FR6**: Against the remote database, the same safety rules hold as with the files, across any number of API processes: stale saves are refused, a running-order save from an old version is refused, role names stay unique within an item, and ids are never reused.
- **FR7**: Deleting a cast member removes them from every role in the same all-or-nothing change, so nobody is ever left cast in a role after they've been deleted.
- **FR8**: The maintainer can copy one production's data from the local files into the remote database in one step: the cast, roles, item notes and every running-order version, with ids, revisions and version numbers kept. Running it again doesn't duplicate or overwrite anything already there.
- **FR9**: The maintainer can verify the copy: the tool reads every collection and every running-order version through the API from both sources and reports any difference. It reports a clear pass only when all match.
- **FR10**: Removing the local data files is a separate, deliberate step. It is refused unless a passing verification of the same production, made after the last copy, is on record, and it lists what it will remove and asks for confirmation first.
- **FR11**: CI tests the remote data layer against a local database emulator, with no AWS account or credentials, on every pull request.
- **FR12**: The repository says how to set up the AWS account, deploy, copy, verify and remove the local files, in order, for a maintainer who hasn't done it before.

## Non-functional requirements

- **Security**:
  - The remote database is reachable only with the maintainer's AWS credentials. Nobody else has AWS access before the API is hosted. Nothing in it is publicly reachable.
  - No credentials or account ids in the repository; the maintainer's machine supplies them.
  - Data is encrypted at rest and in transit.
  - The copy and verify steps never print names or other cast details. Differences are reported by collection and id only (ADR 0010: no names in logs).
  - Tests, CI and the emulator use made-up data only.
  - The data stays in a UK region.
- **Accessibility**: no user-facing change. The pages keep their current WCAG 2.2 AA behaviour.
- **Performance**: each page's data loads in under 1 second from the maintainer's machine in the UK at normal broadband speeds. Saves complete in under 1 second.
- **Reliability**: until the local files are removed, switching back to them is a configuration change, with no data lost.
- **Cost**: pay-per-use only, with no always-on servers.

## Constraints and assumptions

- **Constraints**:
  - ADR 0015 decides the database and its design. ADR 0010 governs personal data.
  - No AWS account exists yet; the maintainer creates one before the first deploy.
  - The CDK app is the only way infrastructure is created (no hand-made resources).
  - Deploys are manual, from the maintainer's machine, and each needs their approval (CLAUDE.md).
- **Assumptions to validate**:
  - The region is eu-west-2 (London).
  - One production (2027) moves; the copy tool takes a production id anyway.
  - The maintainer's machine has the AWS CLI and a named profile for the account.
  - Nobody edits the data during the move, which is short. The team is told before it starts.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Local files are removed before the remote copy is complete, losing the only copy | L | H | FR10 refuses removal without a passing verification since the last copy; it also confirms first. Back up the data folder before the move, and remove that backup once the move is verified. |
| A store bug corrupts or loses data in the remote database | M | H | Emulator tests for every store rule (FR11); 7-day point-in-time recovery (FR2); verification before cut-over (FR9). |
| Someone edits through a still-running file-backed API during the move, so the two copies diverge | L | M | Announce the move. Verification catches any difference, and the copy can be re-run before removal. |
| A tear-down of the stack deletes the table | L | H | FR3: the data store is retained when the stack is removed. |
| Unexpected AWS charges | L | L | Pay-per-use only; a budget alert defined in the infrastructure code (FR13). |
| Leaked AWS credentials expose the cast | L | H | Credentials stay on the maintainer's machine with a least-privilege profile; MFA on the account (FR12 guide). |
| The 7-day backup window still holds a deleted child's data for a week | M | M | Recorded in ADR 0010 (FR2). There is no privacy notice to update. |

## Open questions

- Resolved 2026-10-17: the budget alert goes to the maintainer's own email, supplied at deploy time and never committed. There is no privacy notice, so the 7-day window goes in ADR 0010. The budget alert is in the CDK code. Only the maintainer has AWS access before hosting.
