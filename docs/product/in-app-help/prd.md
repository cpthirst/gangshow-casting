---
feature: in-app-help
status: approved
owner: Nick Hirst
date: 2026-10-19
---

# In-app help: PRD

## Problem

The production team are non-technical volunteers. Many of them use the app only now and then, often in a rush during or after a rehearsal. Nothing in the app explains what its icons and buttons do. Since team roles arrived, people also can't tell which actions their account allows. A Read-Only Team Member sees the same pages as the casting team but can't change anything, and nothing says which actions those are. Today the answer is to ask the maintainer or the casting lead.

People need a short, friendly explanation, and they need it on the page they're using.

## Users

| User | Need |
|---|---|
| Casting Team Member | A quick reminder of what a button or icon does on the page in front of them, without leaving it. |
| Read-Only Team Member (creative team reviewer) | To know what they can look at and which actions are for the casting team, so a missing or refused action isn't a surprise. |
| New volunteer (any role) | One place to get a feel for the whole app on their first visit. |
| Admin | To point new people at something rather than explain each page in person. |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Help is short enough that people read it | Length of each page's help | At most ~8 short lines (one line per action), readable in under a minute |
| Every page in scope has help | In-scope pages with a help entry and a help button | 5 of 5 (Running order, Cast, Casting overview, Casting items, an item) |
| People can tell what their role allows | Actions in each page's help with an access label | 100% |
| The two places never disagree | Help text written once and shown in both the Welcome page and the page's help | 100% of pages |

## Non-goals

- Account management. The Accounts page gets no help entry or help button, and the Welcome page doesn't describe it.
- Screenshots, videos or animated tours. Help shows the app's real icons and buttons inline instead, so it can't go out of date.
- Long-form guides, a manual, search or a FAQ.
- Help for the sign-in screen.
- Tailoring help to the viewer's role or hiding actions from it. Everyone sees the same help, with labels.
- Remembering whether someone has read the Welcome page, or showing it only once.
- Help that admins can edit in the app. Changes to the wording go through the normal change process.
- Tooltips on individual buttons.

## Functional requirements

- **FR1**: There is a Welcome page, the first entry in the menu, labelled "Welcome". Signing in, and opening the app's address with no page, lands on it.
- **FR2**: The Running order stays in the menu and keeps working from its own address. The menu still marks it as current when it's open.
- **FR3**: The Welcome page opens with a one- or two-line introduction to the app. Below it is one short section per in-scope page, in menu order, each linking to its page.
- **FR4**: Each page's section explains each icon and button on that page in one short line. Where the meaning depends on it, the explanation shows the real icon or button the line refers to.
- **FR5**: Each explanation says who can use it, with one of three labels: "Everyone" (including read-only), "Casting team and admins", or "Admins only" (such as saving the running order or deleting a cast member). The labels are the same words everywhere.
- **FR6**: Each in-scope page (Running order, Cast, Casting overview, Casting items, and a single item) has a help button at the top right of the page.
- **FR7**: The help button opens that page's help, the same text as its Welcome page section, without leaving the page or losing anything the user has typed or left unsaved.
- **FR8**: The help can be closed with a visible close button, with Escape, or by clicking or tapping outside it. Closing returns the user to where they were.
- **FR9**: Each page's help is written once and shown in both places, so the Welcome page and the help button can't disagree.
- **FR10**: The single item page's help also says how to reach it (Casting → Items), since it isn't in the menu.
- **FR11**: All of this is the same for every role. The access labels (FR5) do the telling.

## Non-functional requirements

- **Security**: The help is fixed text written with the app. It includes no cast data, no real names and no examples drawn from the real production. The Welcome page sits behind sign-in like every other page. It loads nothing from third parties.
- **Accessibility**: WCAG 2.2 AA. The help button has an accessible name that says which page's help it opens, such as "Help for Cast". The open help is announced as a dialog with its own heading. Focus moves into it, stays inside while it's open, and goes back to the help button on close. Inline icons have text alternatives, or text next to them, so the meaning doesn't depend on seeing the icon. Each access label is a word, not only a colour.
- **Performance**: Help opens at once, with no network request. The Welcome page appears as quickly as any other page.
- **Phone use**: The Welcome page and the open help work at 320px wide without sideways scrolling. The help button stays reachable at the top right on a phone without crowding the page title.

## Constraints and assumptions

- Five pages are in scope today: Running order, Cast, Casting → Overview, Casting → Items, and the single item page. A page added later should get its help as part of its own work.
- The help describes the app as it is. Each change that adds, removes or renames a button on a page in scope updates that page's help in the same change.
- Access labels follow ADR 0020's roles: Admin, Casting Team Member, Read-Only Team Member.
- Old bookmarks to the app's address with no page now open the Welcome page instead of the Running order. Agreed as acceptable: the Running order is the next menu entry.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Help goes stale as pages change | M | M | Written once (FR9), real icons instead of screenshots, and the rule that a page's changes update its help |
| Help grows into "war and peace" | M | M | The ~8-line target per page; one line per action |
| Regular users find landing on the Welcome page slower than landing on the Running order | M | L | Running order is the next menu entry. Revisit if people complain |
| The help button crowds the page title on a phone | L | M | Covered by the phone-width requirement and the existing layout checks |

## Open questions

- None. Resolved: the menu label is "Welcome" (FR1), and the item page's help says how to reach it (FR10).
