---
feature: casting-menus
status: approved
owner: cpthirst
date: 2026-10-15
---

# Casting menus: PRD

## Problem

The menu has one placeholder for casting, "Casting grid" (app-shell FR2). The work of casting now splits into two views: the show as a whole, and roles item by item. There's nowhere in the menu for the second. The team needs one recognisable "Casting" area with both views inside it, before either view is built.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting (directors, item leaders) | Get to the show-wide view or a single item's casting in one step |
| Volunteers updating after a rehearsal, often on a phone | The same menu on a small screen, without hunting for it |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Both casting views are one step away | Clicks from any page to Overview or Items | 1 (2 on small screens: open menu, then choose) |
| The menu matches how the team talks | Menu names the team doesn't recognise, when checked with them | 0 |
| Casting pages can be linked to | Casting pages that load correctly from their URL directly, after refresh, and via back/forward | All of them |

## Non-goals

- The content of the Overview page. It stays a placeholder until its own PRD.
- The content of the Items page and the item pages (see casting-items and casting-item-overview).
- Any other changes to the menu or the layout.

## Functional requirements

- **FR1**: The "Casting grid" menu entry must become **Casting**, a group in the menu with two sub-pages in this order: **Overview** and **Items**.
- **FR2**: Overview must be a placeholder page with its title and a one-line description: who is in which item across the whole show.
- **FR3**: Each sub-page must have its own URL, under a shared casting path, with the same rules as other menu pages: it loads directly, survives a refresh and works with back and forward. The browser tab names the page.
- **FR4**: The old "Casting grid" URL must take the user to the Overview page, so existing bookmarks still work.
- **FR5**: The menu must show which sub-page is current, visually and to assistive technology. While the user is on a single item's page (casting-item-overview), **Items** shows as current.
- **FR6**: On small screens, the sub-pages must appear in the same slide-out menu as the other pages (app-shell FR6), and choosing one closes the menu.

## Non-functional requirements

- **Security**: no data is involved. The pages hold no cast data.
- **Accessibility**: WCAG 2.2 AA. The group and its sub-pages are announced as a nested list, so a screen reader user knows Overview and Items belong to Casting. Everything works by keyboard.
- **Performance**: moving between casting sub-pages feels instant, with no full page reload, like the other menu pages.

## Constraints and assumptions

- Builds on the app shell (app-shell PRD): the same sidebar, menu and mobile menu. Adding a page stays one page plus one menu entry.
- **Assumption**: "Casting" is a group label, not a page of its own, and its sub-pages are always shown, not folded away. That suits a menu with only four destinations.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nesting makes the menu harder to scan on a phone | L | L | Only two sub-pages, always shown. Check on a 360px screen |
| Bookmarks to the old "Casting grid" URL break | L | L | FR4 sends them to Overview |

## Open questions

- Should "Casting" fold its sub-pages away (opening on click) instead of always showing them? Owner: production team.
- Is "Overview" the name the team uses for the show-wide view? Owner: production team.
