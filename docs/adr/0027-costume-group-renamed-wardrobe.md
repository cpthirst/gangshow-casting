# 0027. The costume group renamed wardrobe, in one release

- **Status**: Accepted
- **Date**: 2026-10-26
- **Deciders**: Nick Hirst

## Context

The show calls the department **Wardrobe**, not Costume (production-overview FR1). ADR 0026 made each department permission a user pool group of the same name, so the permission's name is the group's name, `costume`. Renaming it everywhere means renaming the group.

A user pool group can't be renamed. Changing its name replaces it: the new group starts empty, and the old one is deleted with its memberships. Today the Costume permission lets an account change nothing, because no Costume page has been built (production-props FR2). The maintainer confirmed that no account relies on it.

## Options considered

1. **Swap the group in one release**: `wardrobe` replaces `costume`, and nothing moves anyone across.
   - Pros: one deploy, and no command to write, run and later remove.
   - Cons: anyone who did have Costume ticked loses it silently, and an admin has to tick Wardrobe for them.
2. **Move members across**, as ADR 0026 retired `read-only`. Release 1 adds `wardrobe`, with `costume` still counting as Wardrobe. Then a repeatable `pnpm account` command moves each member across, and a later release deletes `costume`.
   - Pros: nobody loses a tick.
   - Cons: two releases, a command, and code that maps the old name to the new one, all to keep a permission that grants nothing.
3. **Keep `costume` as the group, and call it Wardrobe only on the pages.**
   - Pros: nothing changes in the pool.
   - Cons: the code, the API and the pool keep a name the show doesn't use, against FR1, and the two names drift further apart as Wardrobe's pages are built.

## Decision

We will use option 1.

- The pool's `costume` group is replaced by `wardrobe`, named `WARDROBE_GROUP` in the shared code. The permission is `wardrobe` everywhere: in tokens, the Accounts API, and the local switch.
- `costume` becomes an unknown group. Like any unknown group, it grants nothing (ADR 0026). So a token issued before the deploy, which can carry `costume` for up to 5 minutes, is treated as having no Costume permission, and that never widens access.
- The Wardrobe menu page is renamed too: its address is `/production/wardrobe` (the old one redirects), and the Usage page records it as `wardrobe`. Visits already stored as `costume` are read as `wardrobe`, so they still count. The maintainer chose this over keeping `costume` as a hidden internal name.

This amends ADR 0026: its groups become `admin`, `casting`, `stage`, `tech` and `wardrobe`. Everything else in it stands.

## Consequences

- **Easier**: the app, the API and the pool all use the show's word. There's nothing to run after the deploy.
- **Harder**: anyone in `costume` when it deploys loses that tick without warning, and needs Wardrobe ticking by an admin. The release notes say so.
- **Revisit if**: a department is renamed after its pages hold data someone relies on. Then a move like option 2 is needed.
