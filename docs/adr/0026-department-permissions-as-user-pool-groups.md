# 0026. Department permissions as user pool groups, with each change route naming its permission

- **Status**: Accepted
- **Date**: 2026-10-25
- **Deciders**: Nick Hirst

## Context

The production-props PRD lets the props team keep props without being able to change casting. It also lets one person work across departments, such as a stage manager with Stage and Tech. Every account becomes either an Admin, or has any mix of four permissions: Casting, Stage, Tech and Costume. An account with none is read-only (FR1, FR2). The API must refuse every change outside an account's permissions (FR4), and existing accounts must keep exactly their access (FR5).

ADR 0020 gives each account one role from three user pool groups (`admin`, `casting`, `read-only`). It has one rule: read-only may only read, and anyone else may change anything that isn't admin-only. It says to revisit "if a role needs some changes but not others". This is that case.

What's there today:
- every Casting Team Member is in `casting`, every admin in `admin`, and every Read-Only Team Member in `read-only`;
- a role comes from the token's `cognito:groups` claim;
- sign-ins last 5 minutes (team-roles E4.S1);
- the read rules (every `GET`, the Excel export, recording usage: ADR 0021, ADR 0023) and the admin-only list are in `packages/shared`.

## Options considered

1. **One group per permission, alongside `admin`; `read-only` retired.**
   - Pros: `casting` and `admin` already mean what they will mean, so those accounts don't move. Any mix of departments is just several groups in the token. A role and its permissions keep a single source of truth, the pool, as in ADR 0020.
   - Cons: the accounts in `read-only` need moving out after the deploy. Once the group is gone, nothing overrides a mistaken extra group.
2. **The same, but `read-only` kept as an override** that cancels every other group.
   - Pros: no move at all, and a stray extra group can't widen a reviewer's access.
   - Cons: two ways to say "read-only" (no groups, or `read-only`), and a group the Accounts page has to keep in step with the tick boxes. The maintainer chose to retire it instead.
3. **Permissions kept in our own table**, looked up per request.
   - Pros: none that the pool doesn't already give.
   - Cons: ADR 0020 option 3's costs, a second source of truth, a lookup on every request and a wider grant for the data function, all still apply.

## Decision

We will use option 1.

- **Groups:** the pool has `admin`, `casting`, `stage`, `tech` and `costume`, named in the shared code beside `ADMIN_GROUP`. `stage`, `tech` and `costume` are new.
- **Working out access:** it comes from the token's groups.
  - `admin` makes an Admin, who may change everything. Admin is exclusive: an Admin's other groups are ignored.
  - Otherwise each known department group adds that permission, so an account can have any mix.
  - Unknown groups add nothing, and an account in no known group is read-only.
- **Each change route names its permission in one place.** The shared code has a table from every route that isn't a read to the permission it needs, `"admin"` for the admin-only ones.
  - The table is typed against the list of routes, so a new change route that isn't in it fails the typecheck.
  - At runtime, a route missing from the table needs an Admin, so a gap fails safe.
  - Every route that changes data today needs Casting, or stays admin-only.
  - Reads stay open to everyone (ADR 0021, ADR 0023).
- **Refusals:** the entry point refuses, before any handler runs, a change the caller's permissions don't allow. The response is 403 with "You have read-only access." An admin-only route still answers "Only admins can do this." to everyone but admins.
- **Retiring `read-only`:**
  - **Release 1** adds the new groups and the enforcement. While the group still exists, being in `read-only` grants nothing and still cancels every other group. That way an account isn't widened before it moves.
  - **The move:** straight after the deploy, the maintainer runs `pnpm account roles`, which takes every account out of `read-only`. Each such account then has no groups, and so stays read-only. The command only ever removes `read-only`, and never adds a group, so it is safe to repeat. It reports how many accounts it checked and how many it moved.
  - **A later release** deletes the `read-only` group from the pool and drops the override, once the command reports nothing left to move.
- **No one is signed out, and no one's access changes:**
  - Casting Team Members and admins are untouched.
  - A read-only member's token may still carry `read-only` for up to 5 minutes after the move. That doesn't matter, since both mean read-only.
- **Local development and the demo** still start as an admin. The local switch keeps naming today's three roles until production-props.E2.S3, which lets it choose any mix of permissions. The hosted API never reads the switch's header (ADR 0020).

This amends ADR 0020. Its groups-in-the-token approach, its fail-safe and its rollout pattern stand. Its single read-only rule and its one role per account are replaced.

## Consequences

- **Easier**:
  - A new department is one group and one permission name. Its routes say which permission they need.
  - A new change route can't go unguarded: the typecheck catches a missing entry, and the runtime treats it as admin-only.
  - Most accounts don't move at all.
- **Harder**:
  - Two releases to remove `read-only` completely, with the command run between them.
  - Tokens and the Accounts API now carry a set of permissions, not one role, so the account schemas change (production-props.E2).
  - Once `read-only` is gone, a mistaken extra group widens access. The Accounts page is the only place that sets groups, so this would take an edit in the AWS console.
- **Revisit if**:
  - a department needs some of its changes but not others;
  - permissions need to differ by production;
  - the pool's limit on groups per token becomes a constraint.

## Later changes

Recorded as the production-props stories were built, so this record stays true without rewriting the decision above.

- **production-props.E1.S2**: a refusal names the department, rather than one "You have read-only access." for all. A Casting refusal says "You can view the casting, but not change it.", and a department without its own line says "You can view this, but not change it." Pages recognise any of them as read-only. Admin-only routes still answer "Only admins can do this." The maintainer chose this so that someone with only Stage isn't told they're read-only everywhere.
- **production-overview.E1.S1**: the `costume` group is renamed `wardrobe` in one release, with no move ([ADR 0027](0027-costume-group-renamed-wardrobe.md)).
- **production-scenery.E1.S1**: a `director` group joins the others, and a change route names one or more permissions, any of which allows it ([ADR 0029](0029-director-permission-and-routes-naming-any-of-several.md)).
