# 0029. A Director permission, and change routes that name any of several permissions

- **Status**: Accepted
- **Date**: 2026-10-29
- **Deciders**: Nick Hirst

## Context

The production-scenery PRD adds **Director**: a permission that changes every Production department (Scenery, Props, SFX, Mic plot, Wardrobe) but not casting, the show or anything admin-only (FR1, FR2). It combines with the other permissions like a tick box. Scenery is also shared: Stage and Tech may both change it (FR5).

ADR 0026 made each permission a user pool group, and has each change route name **exactly one** permission in a shared table. Director can't fit that rule: props routes would need Stage *or* Director, and scenery routes Stage, Tech *or* Director. Adding Director must not change any existing account's access (FR4).

## Options considered

1. **A `director` group, and each change route names a list of permissions, any of which allows it.**
   - Pros: the table stays the one place that says who may change what, typed against the routes. Director's reach is written route by route, so it can't drift onto casting by accident. Scenery's shared routes need nothing special.
   - Cons: every department route has to remember to list Director. A test on the table catches one that forgets.
2. **A `director` group that the access check treats as "every department but Casting".**
   - Pros: department routes stay one permission each.
   - Cons: a special case in the check, hidden from the table, and it still can't express Scenery being both Stage's and Tech's.
3. **Make Director an Admin-like role**, exclusive of the others.
   - Pros: simple.
   - Cons: against FR1, which makes it combinable, and an exclusive role would need its own rules everywhere Admin has them.

## Decision

We will use option 1.

- **Group:** the pool gains a `director` group, `DIRECTOR_GROUP` in the shared code, and `director` joins the permissions. Nobody is added to it on deploy, so no account's access changes. As before, Admin is exclusive: an Admin's `director` group is ignored.
- **Routes name one or more permissions.** Each entry in the table is `"admin"` or a non-empty list of permissions. A caller with any one of them may use the route.
  - Props and props notes name Stage and Director.
  - Casting routes still name Casting alone, and the running order stays admin-only, so Director can't change them.
  - Each later department route names its department and Director (SFX and Mic plot: Tech; Wardrobe: Wardrobe; Scenery: Stage and Tech).
- **Refusals** use the line of the first permission a route names. Props say "You can view the props, but not change them." Director has no line of its own, so falls back to the general one, which pages still recognise as read-only.
- **The fail-safe stands:** the table is typed against the routes, and a route missing from it needs an Admin.
- **Pages** show a department's change controls to anyone with any of its permissions, so a Director sees the props controls and the Overview's "Edit" buttons.
- Until production-scenery.E1.S2, Director has no tick box on the Accounts page or the local switch. An account can only be given it in the AWS console, for testing. Changing such an account's access on the Accounts page keeps Director.

This amends ADR 0026 (and ADR 0027's list of groups): the groups become `admin`, `casting`, `stage`, `tech`, `wardrobe` and `director`, and a change route names one or more permissions instead of exactly one. Everything else stands.

## Consequences

- **Easier**:
  - A department shared by several permissions, like Scenery, is just a longer list.
  - Director's reach is visible in one table, and tests check it route by route.
- **Harder**:
  - Each new department route must list Director as well as its department. The table's test fails if a department route leaves it out.
  - A route's refusal line depends on the order its permissions are listed in.
- **Revisit if**:
  - Director should reach some of a department's changes but not others;
  - routes start needing *all* of several permissions, rather than any one.
