---
feature: app-shell
status: approved
owner: cpthirst
date: 2026-10-10
---

# App shell: PRD

## Problem

The app is a bare walking skeleton: a heading and an API status line. Before any casting feature can be built, the production team needs a recognisable, navigable home for those features: a consistent layout, a menu of the main areas, and a look that feels like part of Gang Show and Scouting rather than a developer tool. Without it, every casting story would have to invent its own page structure.

## Users

| User | Need |
|---|---|
| Production team volunteers (directors, item leaders, choreographers, wardrobe, stage management) | Find the area they need at a glance, on a laptop at home or a phone at rehearsal, without training |
| Developers and agents building later stories | A place to add each new page that is already styled, routed and tested |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Every main area is one step away | Clicks from any page to any menu page | 1 (2 on small screens: open menu, then choose) |
| Pages can be linked to and survive a refresh | Menu pages that load correctly from their URL directly, after refresh, and via back/forward | 3 of 3 |
| Usable on a phone at rehearsal | Layout works with no horizontal scrolling at 360px width | Yes |
| Accessible to everyone on the team | Automated accessibility violations (axe) on each page | 0 |
| A new page is cheap to add | Steps to add a menu page: one page, one menu entry | Documented in the story; no layout changes needed |

## Non-goals

- Any real casting data, forms or API endpoints beyond the existing health check.
- Sign-in or access control. This is required before any casting data is shown, and needs its own story and ADR.
- Choosing or switching between productions (years).
- A logo image, dark mode, settings or user profile pages.
- Hosting or deployment.

## Functional requirements

- **FR1**: The app must show a persistent layout: a left-hand sidebar with the "Chester Gang Show" wordmark and the menu, and a main content area for the current page.
- **FR2**: The menu must contain three placeholder pages, in this order: **Running order**, **Cast**, **Casting grid**. Each page shows its title and a one-line description of what it will be for.
- **FR3**: Each menu page must have its own URL, so that loading it directly, refreshing and the browser's back and forward buttons all show the right page. The browser tab title must name the current page.
- **FR4**: Opening the app at its root must show the Running order page. An unknown URL must show a "page not found" message with a way back to the menu.
- **FR5**: The menu must show which page is current, both visually and to assistive technology.
- **FR6**: On small screens (phone width), the sidebar must be hidden behind a menu button. Opening it shows the menu over the page. Choosing a page or dismissing it closes the menu.
- **FR7**: The existing API status indicator must stay visible somewhere in the shell, so a broken API is still obvious.
- **FR8**: The visual style must follow the Scouts brand used by other Gang Shows (see Constraints): Gang Show red as the primary colour, Nunito Sans type, and white and light grey surfaces with dark grey text.

## Non-functional requirements

- **Security**: No personal or casting data is shown or stored. The shell makes no requests to third-party services: fonts and assets are bundled with the app, so no visitor IP addresses go to outside providers (UK GDPR).
- **Accessibility**: WCAG 2.2 AA. Text contrast is at least 4.5:1 (3:1 for large text). The whole shell can be used with the keyboard alone: menu button, menu links and dismissing the mobile menu. Focus is visible, and there is a skip link to the main content.
- **Performance**: Moving between menu pages feels instant, with no full page reload. The first load on a mid-range phone over 4G takes under 2 seconds.

## Constraints and assumptions

- **Brand reference**: [Blackpool Gang Show](https://blackpoolgangshow.org.uk/), which uses the Scouts "Skills for Life" theme. Taken from it:
  - Gang Show red `#ed3f23` for large text, accents and the active-page indicator. Use the deeper `#e22e12` wherever normal-size white text sits on red, because white on `#ed3f23` is only 3.94:1.
  - Text `#404040` on white, with `#f1f1f1` surfaces.
  - Nunito Sans type.
- **Wordmark**: text only, "Chester Gang Show" with the app's name, "iCUE", under it, and "Show Management App" in italics beneath that. No logo image. (Changed on 2026-10-24: the subtitle was "Casting" until the app was named iCUE.)
- **Routing**: page-level URLs mean adding a client-side router, a new dependency. Per CLAUDE.md, that needs an ADR, recorded alongside the first story.
- **Assumption**: the existing walking-skeleton heading is replaced by the shell, and its health check moves into the shell (FR7).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| URL-based pages 404 on refresh once hosted, if the host doesn't fall back to the app | M | M | Works in local dev now. Note it as a requirement for the future hosting ADR |
| Placeholder menu names don't match how the team talks about the show | M | L | Names are cheap to change. Check them with the production team before building real pages |
| Scouts brand use outside official guidelines | L | L | Colours and font only, no Scouts logos. Revisit if a logo is added |

## Open questions

- Should a "Home" or dashboard page exist later, or is Running order the right landing page? Owner: production team.
- Do the menu names match the team's own vocabulary? Owner: production team.
