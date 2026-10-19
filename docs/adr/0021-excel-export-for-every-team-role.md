# 0021. The casting grid's Excel export for every team role

- **Status**: Accepted
- **Date**: 2026-10-19
- **Deciders**: Nick Hirst

## Context

ADR 0019 made the casting grid's Excel export admin-only, because the file is a copy of children's names that sits outside the app's access control. ADR 0020 then refused every route that isn't a `GET` for a Read-Only Team Member. The export is a `POST` (the page sends the grid it shows), so that rule refuses it too.

The maintainer wants every signed-in team member to export the grid: Admins, Casting Team Members and Read-Only Team Members alike. The creative-team reviewers that read-only exists for are the people who take the grid to planning meetings. Every role can already see the same grid on screen, and could copy it by hand.

## Options considered

1. **Keep export admin-only** (ADR 0019): the fewest copies of the file. Cons: reviewers and the casting team have to ask an admin for each copy, so copies go out of date, which is the problem team-roles set out to fix.
2. **Every role may export; the export route counts as a read**: the route leaves the admin-only list. The shared rule that decides what a read-only member may do lists it beside the `GET` routes, because it changes nothing: it only turns the grid the page sends into a file. Cons: more copies of the children's names outside the app, made by more people.
3. **Every role may export, through a new `GET` route that builds the grid on the server**: keeps "only `GET` is a read" true. Cons: the server would need its own copy of the grid's ordering rules, which ADR 0019 chose not to duplicate.

## Decision

We will use option 2.

- **Who may export:** every signed-in team member, whatever their role. The page shows "Export to Excel" to everyone on the grid.
- **API:** `POST /api/productions/{productionId}/casting-grid/export` leaves the admin-only route list (ADR 0018). The shared rule naming the routes a Read-Only Team Member may use lists it explicitly as a read that changes nothing. Any other route that isn't a `GET` is still refused, so a new change route is still covered automatically (ADR 0020).
- **Unchanged from ADR 0019:** the server builds the file from the grid the page sends, with the same strict schema, size limits, fields and file name.
- **The "team only" note:** removed. The button now says "Export to Excel" in words, and the maintainer chose not to keep ADR 0019's hover note beside it.
- **The post-deploy check** no longer expects the export to be refused for the member or the read-only account. It gets that from the shared lists, with no special case.

This amends ADR 0019's "Who may export" and its "team only" note, and ADR 0020's "API refusals". Their other decisions stand.

## Consequences

- **Easier:**
  - Reviewers and the casting team take the grid to meetings without asking an admin.
  - Nothing new to host, and no new dependency.
- **Harder:**
  - More people can make copies of the children's names outside the app's access control, and the page no longer reminds them that the file is for the team only.
  - The server trusts the grid any team member sends, not only an admin's. It still accepts only the allowed fields, and only from someone signed in, who could see that grid anyway.
  - The post-deploy check sends no body, so it can't make a real export: it no longer expects the export to be refused, but doesn't prove it works either. The API's tests do.
  - "Only a `GET` is a read" now has one named exception. Any further exception needs the same reasoning: it must change nothing that's stored.
- **Revisit if:** an exported file is shared outside the team; the export starts storing or changing anything; or the team wants an audit of who exported.
