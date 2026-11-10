---
feature: production-cast-flow
status: approved
owner: Nick Hirst
date: 2026-11-10
---

# Cast flow: PRD

## Problem

Backstage space is tight, and most of the cast are children. The stage manager calls people from the dressing rooms to the Backstage holding area (for props, mics and quick changes) about 5–7 minutes before their item. They then call them to Standby in the wings about 3–5 minutes before curtain. When the next item's call overlaps with the current one, the wings and holding area can get crowded. Nobody can see that coming today without working it out by hand from the running order and the casting.

iCUE already knows the running order, each item's timing, and who is cast in every role, ensemble included. It can estimate how many people are in each place at any moment and show where the crowding happens.

The idea comes from `docs/product/future-thinking.md` ("Backstage hotspot"). The product owner added a fourth place, the Dressing Room, where cast are assumed to be when they aren't called, and asked for a line graph over the show's time (2026-11-10).

## Users

| User | Need |
|---|---|
| Stage manager, backstage crew | To see when the wings and holding area will be crowded, so they can plan calls and the space |
| Director, casting team | To spot where the running order or casting makes a crowd, and change it |
| Dressing room chaperones | To see when the dressing rooms empty and fill up |
| Anyone on the team | To check the show's flow without changing anything |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| See backstage crowding before the show | Clicks from the menu to the graph of the whole show | 1 |
| The graph matches the show as it stands | Changes to the running order, timings, casting or cast list that the graph doesn't reflect the next time it's opened | 0 |
| Spot the peak quickly | Clicks to compare one or more places on their own | 1 per place hidden or shown |
| Every person is somewhere | Moments where the four places' counts don't add up to the whole cast list | 0 |

## Non-goals

- **Anyone's exact whereabouts.** The page shows estimated counts per place, not which person is where.
- **Changing the call times** (6 and 4 minutes), per production or per item. They are fixed for everyone.
- **Live updates while the page is open.** It shows the show as saved when the page was opened.
- **Times outside the show,** such as arrival, warm-up or the curtain call after the finale.
- **Crew and adult volunteers.** Only the cast list is counted.
- **Editing anything** (running order, timings, casting) from this page.
- **Capacity limits or warnings** for each place.
- **An export or print** of the graph.

## Functional requirements

### Where the page sits
- **FR1**: Production's menu group gains a second page, **Cast flow**, after Overview. Every role that can open Production can open it. It shows the current production, chosen as every other page chooses it, never a fixed one.
- **FR2**: The page is recorded on the Usage page as other pages are.

### Who is where
- **FR3**: At every moment of the show, each person on the production's cast list is in exactly one of four places: **On-stage**, **Standby** (in the wings), **Backstage** (the holding area), or **Dressing Room**.
- **FR4**: A person is On-stage while an item they are cast in is running, in any role of any size. Each person in an ensemble counts individually.
- **FR5**: A person is in Standby from 4 minutes before an item they're cast in starts until it starts. They are Backstage from 6 minutes before it starts until they move to Standby.
- **FR6**: When more than one place applies, the one nearest the stage wins: On-stage, then Standby, then Backstage. This covers someone who comes straight off one item and is called for the next.
- **FR7**: Everyone on the cast list who isn't On-stage, in Standby or Backstage is in the Dressing Room, including people cast in no item.
- **FR8**: Times come from the latest saved running order: its start time, each item's length in order, and the interval between the halves. An item with no length set counts as 5 minutes long. The calls for the first item after the interval begin during the interval, as they would on the night.

### The graph
- **FR9**: The page shows one line graph of the whole show. Time runs along the bottom as clock times, from the first call before curtain up to the end of the last item. The number of people runs up the side.
- **FR10**: Each place has its own line in its own colour, all on the same scale.
- **FR11**: The start of each item is marked on the time axis with its number, or its title where it has no number. Hovering over a marker or a point on the graph, or focusing it, shows the item and each place's count at that time.
- **FR12**: The graph's key lists the four places, each with a tick box. Unticking a box hides that place's line and ticking it shows the line again. All four are ticked when the page opens.
- **FR13**: Each place in the key has a short description of what it is, beside its name:
  - **On-stage**: performing in the item that's running.
  - **Standby**: in the wings, from 4 minutes before their item.
  - **Backstage**: in the holding area for props, mics and quick changes, from 6 minutes before their item.
  - **Dressing Room**: everyone else on the cast list.

  The descriptions are part of the key, the one place the graph's places are named, so the page and Help read them from the same list.
- **FR14**: The graph is worked out from the current running order, roles and cast list every time the page is opened. No copy of times or counts is saved, so a change to any of them shows next time.
- **FR15**: With no saved running order, or no cast, the page shows the empty state the other Production pages show in that case, instead of a graph.

### Help
- **FR16**: Help describes Cast flow: the four places (with the same descriptions as the key, FR13), the 5-minute length assumed for untimed items, and that the counts are estimates. Apart from the key's descriptions, the page adds no explanatory line.

## Non-functional requirements

- **Security**: Read-only, behind the existing sign-in and production-team permissions. It shows counts only, never names, and adds no new personal data and no new API data beyond what the running order, roles and cast list already return.
- **Accessibility**: WCAG 2.2 AA. The tick boxes in the key are labelled and keyboard-operable, and each one's description is read with its label. Lines are told apart by more than colour (for example line style or markers), and the colours meet contrast against the page in light and dark themes. The counts at each item's start can be read without seeing the graph, for example as a table a screen reader can reach.
- **Performance**: The graph appears within 1 second of the page's data loading for a show of 60 items and 300 cast. Hiding or showing a line responds immediately (under 100 ms). The page makes no API calls beyond those it needs to load the running order, roles and cast list.
- **Layout**: Usable at phone widths (320px) without the page scrolling sideways. The graph may shrink or scroll within itself.

## Constraints and assumptions

- **Charting library.** The product owner asked for a well-known, popular charting library that works well with Vue, rather than a hand-drawn graph. Adding it is a new dependency and needs an ADR. Likely candidates are Chart.js (with its Vue wrapper) and Apache ECharts (with its Vue wrapper). The ADR picks one, weighing bundle size, accessibility and theming.
- The call times (6 and 4 minutes) are the middle of the stage manager's usual ranges, chosen by the product owner (2026-11-10).
- Item start times reuse the running order's existing timing, which the Running order page and the back-to-back clash check already use. There is one way to time the show, not a second one.
- Cast flow keeps no data per item, so cutting an item needs no extra clean-up. The graph simply no longer includes it.
- Scope is per production, from the current production.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Counts are taken as exact and plans rely on them | M | M | The key gives each place's call time (FR13); Help says they're estimates (FR16) |
| The key's descriptions crowd the graph at phone widths | M | L | Descriptions are one short line each and sit with the key, which may wrap below the graph |
| Many untimed items make the graph misleading | M | M | The 5-minute assumption is in Help; timing items in the running order fixes it |
| The charting library is heavy or hard to make accessible | M | M | The ADR compares candidates on size and accessibility; a readable table backs up the graph |
| Four colours are hard to tell apart, or clash with the theme | L | M | Distinct line styles as well as colours, checked in both themes |

## Open questions

- Is 5 minutes the right assumed length for an untimed item? Owner: Nick Hirst.
