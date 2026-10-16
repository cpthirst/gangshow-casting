---
feature: casting-overview
status: approved
owner: cpthirst
date: 2026-10-16
---

# Casting overview: PRD

## Problem

Casting is now recorded item by item, but nobody can see the whole cast at once. To balance the show, the production team needs to know who is carrying the most (and the biggest) parts, and who has little or nothing yet, section by section. Today that means opening every item and counting by hand. The Overview menu page is still a placeholder ("Who is in which item, across the whole show").

## Users

| User | Need |
|---|---|
| Production team in a casting meeting | See at a glance who has the most and biggest parts, and who still needs casting |
| Section leaders (Scouts, Explorers, Network) | See how their section's young people are being cast compared with each other |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Everyone's casting is visible at a glance | Clicks from the Overview to see how many parts of each size a person has | 0 |
| Nobody is missed | Cast members not shown on the Overview | 0 (people with no parts are listed too) |
| The order is predictable | People shown out of the order the ranking rule (FR3–FR5) gives | 0 |
| Gaps are obvious | People with no parts who aren't at the bottom of their section, marked | 0 |

## Non-goals

- Showing which items or roles each person has. The Overview shows counts by role size; the parts themselves are on each item's page.
- Clash and balance warnings: back-to-back appearances, stage time in minutes (the casting rules PRD).
- Editing casting from the Overview, or linking from it. It's read-only.
- Showing a person's score. It's used for ordering only (see Open questions).
- Printing or exporting the Overview.
- More than one production on screen.

## Functional requirements

- **FR1**: The Overview page must list every cast member in the production, grouped into sections in this order: **Scouts**, **Explorers**, **Network**, then **Not set** for people with no section. A section with nobody in it isn't shown. Each section shows how many people are in it.
- **FR2**: Each person's entry must show their name and, for each role size they're cast in, one **pill** with the size and how many roles of that size they have (for example "Lead · 1", "Ensemble · 3"). Pills use the same labels and colours as the role cards on an item's page and appear biggest size first (lead, support, cameo, ensemble). Sizes they have no roles of aren't shown.
- **FR3**: Within each section, people must be ordered by a **casting score**, highest first. Each role scores by its size: **lead 8, support 3, cameo 2, ensemble 1**. A person's score is the sum over all their roles. So one lead (8) ranks above two supports (6) or three cameos (6), while three supports (9) rank above one lead.
- **FR4**: People with the same score must be ordered by their total number of roles (more first), then by last name and first name.
- **FR5**: People with no roles must be listed at the bottom of their section, marked "No parts yet".
- **FR6**: A person counts once for each role they're in. Being cast twice in the same item counts twice; being one of several members of an ensemble role counts as one ensemble role.
- **FR7**: Only roles in items of the latest saved running order count, so the Overview always matches the Items list.
- **FR8**: If the cast, roles or running order can't be loaded, the page must say so rather than show people as having no parts.
- **FR9**: The Overview replaces the current placeholder at its existing menu entry and URL.

## Non-functional requirements

- **Security and safeguarding**: the Overview shows young people's names next to how much they're cast in. It's for the production team only and must never be publicly reachable (CLAUDE.md). It adds no new personal data: names and sections come from the cast list, and roles hold only cast member ids (ADR 0010). Data stays local and git-ignored until hosting and sign-in exist. Tests use made-up names.
- **Accessibility**: WCAG 2.2 AA. Sections are headed and each section is a list, so screen readers announce how many people are in it. Pills carry their size and count as text, not colour alone, and are read as words ("1 lead, 3 ensemble"). Usable at 320px width with no sideways scrolling.
- **Performance**: a cast of about 200 with about 2,000 roles loads and orders in under 1 second locally.
- **UI consistency**: the Overview looks and behaves like an item's casting page (`/casting/items/{itemId}`), so the casting pages read as one set. That means:
  - each person is a card in the same style as a role card: white and rounded, with the name in bold, then the pills, and the same spacing;
  - pills reuse the role cards' size labels, colours and order exactly;
  - section headings match the item page's headings;
  - "No parts yet" uses the same treatment as "Uncast" on a role card;
  - on phones, cards stack the same way and nothing scrolls sideways;
  - any icons added later follow the icon-button conventions shared with the Items list and the Running order: icons first, on the left, on larger screens, and on their own line above the entry on phones.

## Constraints and assumptions

- **Data**: built from what the app already holds: the cast list (names, sections), the roles (sizes and cast member ids) and the latest saved running order (which items count). Expected to need no new API.
- **Scores**: the weights (8, 3, 2, 1) are fixed in the app for now. Changing them later is a small change, so they don't need to be configurable.
- **Pills**: reuse the role-size pills from the item page so sizes look the same everywhere.
- **Scope**: one production (2027). Casting never carries over between productions (CLAUDE.md).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A ranked list of children is read as a judgement of them | M | M | It's for the production team only, never public or exported. The score isn't shown, and the page talks about parts, not people |
| The weights don't match how the team values parts | M | L | Agreed with the user (8, 3, 2, 1). Easy to change; check with the team after first use |
| A deleted cast member's roles distort counts | L | L | Deleting someone already removes them from every role (casting-roles FR9) |

## Open questions

- Should the score itself be shown (for example, to explain the order)? Assumed no. Owner: production team.
- Should an ensemble role count for less when the ensemble is very large? Assumed no: every ensemble role scores 1. Owner: production team.
- Are the weights right once the team has used them in a casting meeting? Owner: production team.
