# 0020. Team roles as user pool groups, with read-only as the fail-safe

- **Status**: Accepted
- **Date**: 2026-10-18
- **Deciders**: Nick Hirst

## Context

The team-roles PRD adds a Read-Only Team Member for creative-team reviewers. It renames today's non-admin team member to Casting Team Member, keeping their permissions. ADR 0018 has one group, `admin`, and treats everyone else as a team member who may change casting.

The PRD needs these things:
- **API enforcement:** the API, not just the pages, refuses every change from a read-only member (FR7).
- **Fail-safe:** an account whose role can't be worked out gets no more than read-only access (security NFR).
- **No new personal data** about the team.

Existing team members are in no group at all, so making "no group" mean read-only would demote them unless they move first.

## Options considered

1. **A `read-only` group, everyone else casting**: no migration, since existing accounts keep their access. Cons: it fails open. An account added outside the app, or one whose group is lost, could change casting.
2. **Groups for every role (`admin`, `casting`, `read-only`), with no group meaning read-only**: fails safe, and each account's role is explicit in the pool and in the sign-in token, as `admin` already is. Cons: existing team members must be moved into `casting`, and their open sign-ins only pick that up when they renew.
3. **Roles kept in our own table and looked up per request**: changes would take effect at once. Cons: a second source of truth beside the pool, a lookup on every request, and a wider grant for the data function (ADR 0017). The PRD settled on a 5-minute delay instead (team-roles E4).

## Decision

We will use option 2.

- **Groups:** the user pool has three groups, `admin`, `casting` and `read-only`, named in the shared code beside `ADMIN_GROUP`.
- **Working out a role:** it comes from the token's `cognito:groups` claim. `read-only` always wins, so a mistaken extra group can't widen access. Otherwise `admin` makes an Admin and `casting` a Casting Team Member, and anything else, including no group, makes a Read-Only Team Member.
- **API refusals:** the entry point refuses, before any handler runs, every route that isn't a `GET` for a read-only member. The response is 403 with "You have read-only access." Admin-only routes still need `admin`, as in ADR 0018. Because the rule covers every route that isn't a `GET`, a new change route is covered automatically.
- **Moving existing accounts:** a repo command, `pnpm account roles`, adds every account that is in no group to `casting`. It only ever adds accounts in no group to `casting`, and never touches an account that has a role, so it is safe to repeat.
  - **Rollout:** one release adds the groups and the enforcement, and the maintainer runs the command straight after deploying. Until an existing member's sign-in renews (within its 1-hour lifetime), the API treats them as read-only and their changes are refused with a clear message. The maintainer accepted this gap rather than two releases.
- **Accounts created in the app** join `casting`, keeping today's behaviour, until team-roles.E3.S2 lets admins choose a role. An admin who loses admin joins `casting` only if they have no other role, so a read-only account is never promoted.
- **Local development**, the demo and the browser tests still act as an admin (ADR 0018). A role switch comes with team-roles.E5.S2.

This amends ADR 0018's single `admin` group. Its other decisions stand.

## Consequences

- **Easier**:
  - Read-only is enforced in one place, for every route, current and future.
  - A lost or missing group never grants more than reading.
  - No new data about the team, and no new AWS service.
- **Harder**:
  - The first deploy needs the command run straight after it.
  - Existing members can't change casting for up to an hour after the deploy.
  - Every route that changes data must not be a `GET`, which is already the API's convention.
- **Revisit if**: a role needs some changes but not others, rather than all or nothing. That would need permissions per route, not one read-only rule.
