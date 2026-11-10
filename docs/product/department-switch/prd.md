---
feature: department-switch
status: approved
owner: Nick Hirst
date: 2026-11-10
---

# Department switch: PRD

## Problem

Each Production department has its own page for an item: Scenery, Props, SFX, Mic plot and Wardrobe. Those pages share one frame, with All items and Previous and Next to move through the running order. To see another department's page for the same item, a volunteer has to go back to the Production overview, find the item again and choose the department's button. At a rehearsal or a production meeting, people often want to see everything for the item in front of them, such as its props and then its mics. Today that takes two extra steps and a search down the list each time.

The idea comes from `docs/product/future-thinking.md` ("Production nav"). Its condition: it mustn't clutter the item pages.

## Users

| User | Need |
|---|---|
| Stage manager, Director | To look across every department for one item without going back to the Overview |
| Department heads (e.g. Wardrobe, Sound) | To check another department's page for the item they're working on, such as its mics while dressing it |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Open another department's page for the same item quickly | Taps from one Production item page to another department's page for the same item | 1 (today: 3 or more, through the Overview) |
| Keep the item pages uncluttered | Height the switch adds at 320px and 360px wide | No more than one row, and no sideways scrolling |

## Non-goals

- The Casting item page. It neither shows the switch nor appears in it.
- Changing All items, Previous or Next. They keep moving between items in running order, within the department you're in.
- Counts, badges or other data in the switch, such as how many props an item has. The Overview already shows them.
- Changes to the sidebar, the Production overview or any list page.
- New data, new API routes or changes to permissions.

## Functional requirements

- **FR1**: Every Production department's page for one item shows a department switch with one entry for each Production department. The entries use the departments' names and icons, in the order the Production overview's buttons show them.
- **FR2**: Choosing a department in the switch opens that department's page for the same item.
- **FR3**: The switch marks the department you're in as current, and that entry is not a link.
- **FR4**: All items, Previous and Next work as they do now. Previous and Next open the neighbouring item's page in the department you're in.
- **FR5**: The switch is part of the shared frame that every Production item page uses, and it reads the shared list of Production departments. A Production department added later joins the switch with no change to the switch itself.
- **FR6**: The switch shows only once the item has loaded. The not-found and error states don't show it.
- **FR7**: Leaving a page through the switch handles unsaved changes the same way Previous and Next do.
- **FR8**: Opening a page through the switch records a visit for that department on the Usage page, as any other visit to an item page does.
- **FR9**: Everyone who can open the Production item pages sees the same switch, whatever their role. It only opens pages, so it never changes with permissions.
- **FR10**: The Help for the Production item pages describes the switch. The pages themselves add no line explaining it.
- **FR11**: At phone width, the switch shows each department's icon only. The department's name is its tooltip and its accessible name.
- **FR12**: The browser layout tests check that the switch stays on one row and causes no sideways scrolling at 320px and 360px wide.

## Non-functional requirements

- **Security**: No new data, routes or permissions. The switch only links to pages the person can already open, behind the existing sign-in.
- **Accessibility**: WCAG 2.2 AA. The switch is a labelled navigation region, separate from the item navigation. Each entry has an accessible name, even when only its icon shows. The current department is announced as current. Entries can be reached and used from the keyboard, and each one is at least 24 × 24 CSS pixels.
- **Performance**: Showing the switch makes no extra API calls. Opening a department through it loads no more than opening the same page from the Overview does.

## Constraints and assumptions

- Builds on the shared item-page frame and department list from the `simplify` feature. The switch joins them; it isn't a copy per page.
- The browser layout tests already walk the item pages at 320px and 360px. The user has agreed to a check for the switch (FR12).
- Assumes everyone who can open one Production item page can open them all, which is true today.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Five entries plus All items, Previous and Next crowd a 320px screen | M | M | One row only (goal 2); icons only at phone width (FR11); a browser layout check (FR12) |
| People confuse the switch with Previous and Next | L | M | Separate, labelled regions that look distinct; Help describes both |
| A future Production department makes the row too long | L | L | FR5 means it joins automatically; the one-row metric catches the overflow |

## Open questions

- None.
