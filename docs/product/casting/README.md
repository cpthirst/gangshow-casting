# Casting

Putting cast members into roles within the show's items. This is the app's core purpose, so it's split into several PRDs. Each folder is its own feature, and story IDs are named after the path (`casting/items` → `casting-items.E1.S1`).

| Feature | PRD | What it covers | Builds on |
|---|---|---|---|
| `casting-menus` | [menus/prd.md](menus/prd.md) | "Casting grid" becomes "Casting", with Overview and Items sub-pages | app-shell |
| `casting-items` | [items/prd.md](items/prd.md) | The list of the running order's items, with role counts | casting-menus, running-order |
| `casting-item-overview` | [item-overview/prd.md](item-overview/prd.md) | One item's page: its name, position and roles | casting-items |
| `casting-roles` | [roles/prd.md](roles/prd.md) | Adding, editing and removing roles, and casting people in them | casting-item-overview, cast-management |
| `casting-overview` | [overview/prd.md](overview/prd.md) | The whole cast by section, ordered by how much (and how big) their parts are | casting-roles |
| `casting-rules` | [rules/prd.md](rules/prd.md) | Back-to-back and timing clashes, flagged as errors and warnings on the item, Items and Overview pages; a `pnpm demo` show to try them | casting-overview |
| `casting-overview-timeline` | [overview/timeline/prd.md](overview/timeline/prd.md) | A row of dots on each Overview card: one per item, green where the person appears, with a gap for the interval | casting-overview |
| `casting-overview-by-item` | [overview/by-item/prd.md](overview/by-item/prd.md) | A By item view on the Overview (items in show order with role name, type and cast), and Word exports: an Item Overview document from that view, and a casting sheet per cast member from the By person view | casting-overview |

A later PRD (not written yet): **uneven stage time**, a further casting rule.

## Build order

Stories cross between these features. This order satisfies every story's "Depends on" (some, like casting-roles.E2.S3, could start earlier):

1. casting-menus.E1.S1 → E1.S2
2. casting-items.E1.S1 → E1.S2
3. casting-item-overview.E1.S1 → E1.S2
4. casting-roles.E1.S1 → E1.S2
5. casting-item-overview.E2.S1
6. casting-roles.E1.S3
7. casting-items.E2.S1
8. casting-roles.E2.S1 → E2.S2, E2.S3, E3.S1 (E3.S1 also needs cast-management.E2.S3, which is done)

## Shared terms

These PRDs share the following terms, so they mean the same thing everywhere:

- **Item**: an entry in the production's **latest saved** running order: a production number, sketch, song or dance. Casting never shows unsaved running-order changes.
- **Role**: a part in one item, with a **role name** (the character name, such as "Fairy Godmother" or "Ensemble") and a **role size**.
- **Role size**: one of **lead**, **support**, **cameo** or **ensemble**, ranked in that order.
- **Cast in a role**: a lead, support or cameo role holds at most one cast member. An ensemble role can hold many. A role with nobody in it is **uncast**.
- **Roles cast**: the number of an item's roles that have at least one cast member.
