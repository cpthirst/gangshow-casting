---
feature: junior-cast
status: approved
owner: Nick Hirst
date: 2026-11-10
---

# Junior cast: PRD

## Problem

The Gang Show has two casts. The Senior cast are Scouts, Explorers and Network members. The Junior cast are Beavers and Cubs. Most items use only one of them, and some, such as an opening or a finale, use both. iCUE knows only the Senior sections, so the Junior cast can't be recorded by section. When someone casts a role, the search offers the whole cast list, whoever the item is for. In a long cast list, the person casting has to remember who is Junior and who is Senior, and it's easy to put someone in an item they won't be at.

The idea comes from `docs/product/future-thinking.md` ("Junior cast"). That note limited it to Ensemble roles. The product owner widened it (2026-11-10): the filter applies to every role size, and it is driven by a label on the item.

## Users

| User | Need |
|---|---|
| Director, casting team | To see only the cast who can be in an item when casting any of its roles |
| Whoever keeps the running order | To mark which cast each item is for |
| Whoever keeps the cast list | To record Beavers and Cubs, and see the Junior or Senior cast on its own |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Cast each item only from the cast it's for | Cast members a role's search offers who don't match the item's cast | 0 |
| No one stays cast in an item they don't match | Cast members in an item's roles who don't match its cast, after any change to an item's gang or a member's section | 0 |
| Record the whole show's cast in iCUE | Beavers and Cubs in the show who can be entered with their section | All of them |

## Non-goals

- Showing the label in the running order's or Casting items' lists. It's seen and changed with the item's details.
- Filtering by anything other than the item's cast, such as age band, group or casting notes.
- Changing the Props carriers or Mic plot pickers. They already offer only the people cast in the item.
- Age bands or any other new personal data. Only the section list grows.
- Carrying labels between productions. Each production labels its own items.

## Functional requirements

- **FR1**: A cast member's section can be Beavers or Cubs, as well as Scouts, Explorers or Network, or not set. Beavers and Cubs are the Junior cast. Scouts, Explorers and Network are the Senior cast. A cast member with no section counts as Senior.
- **FR2**: Each item in the running order is for the Senior cast, the Junior cast, or both. An item is for the Senior cast unless it's marked otherwise. Items that exist before this feature are for the Senior cast.
- **FR3**: The item's cast is set and changed with the item's other details in the running order, by whoever can edit the running order (admins today). The item's details already have a free-text Cast field, so this control is labelled Gang: Senior, Junior or Both.
- **FR4**: When casting any role in an item, whatever its size, the cast member search offers only the cast the item is for: Senior items offer the Senior cast, Junior items the Junior cast, and items for both offer everyone.
- **FR5**: Changing an item's cast removes from its roles everyone who no longer matches. Before saving, the person is told who will be removed from which roles and can go back. When no one is affected, no confirmation is shown.
- **FR6**: Removing someone through FR5 has the same effect on the item's other data (such as Props carriers and the Mic plot) as removing them from the role by hand.
- **FR7**: The Cast page can filter the cast list to the Junior cast or the Senior cast, alongside its section filter. Its section filter includes Beavers and Cubs.
- **FR8**: The Casting overview groups Beavers and Cubs in their own sections, as it does the Senior sections, and its export does the same.
- **FR9**: The section and the item's cast are part of the shared lists everything reads (the list of sections, and the item's details). Each page reads them from there, rather than keeping its own copy of which sections are Junior.
- **FR10**: Cutting an item takes its cast label with it, as with the rest of its data.
- **FR11**: Help describes the Junior and Senior cast, how an item's gang filters the casting search, and what changing an item's gang or a member's section does to roles already cast. The pages add no line explaining it.
- **FR12**: Changing a cast member's section removes them from the roles of every item whose gang they no longer match. Before saving, the person is told which roles in which items they'll be removed from and can go back. Their props and mic channels in those items follow, as in FR6.

## Non-functional requirements

- **Security**: No new personal data beyond two more section values, recorded in an amendment to ADR 0010 because the Junior cast are younger children (Beavers from 6). Casting data stays behind the existing sign-in and production-team permissions. Changing an item's cast is refused, with the running order's own refusal, to anyone who can't edit the running order. Removals under FR5 are checked by the server, not only in the browser.
- **Accessibility**: WCAG 2.2 AA. The item's cast is a labelled control that works from the keyboard. The removal confirmation (FR5) is announced and its list of people can be read by a screen reader.
- **Performance**: Filtering the search adds no extra API calls. Saving a label change that removes people takes no longer than saving the running order does today.

## Constraints and assumptions

- Builds on the running order's item details and the shared cast search from the `casting` and `simplify` features.
- Scope is per production, read from the current production, never a hard-coded id.
- Only admins can save the running order, so only admins set an item's cast.
- The Casting overview's export (ADR 0019 and ADR 0021) needs the new sections. Its section list grows; its layout doesn't change.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A wrong label change uncasts people, losing work | M | H | The confirmation lists who will be removed and from which roles (FR5); nothing changes until it's confirmed |
| Cast members with no section are hidden from Junior items | M | M | They count as Senior by design (FR1); the Cast page's filters show who has no section |
| Adding younger children raises the safeguarding stakes | L | H | No new kinds of data; ADR 0010 amended before any Junior cast is recorded |

## Open questions

- None. A member whose section changes leaves the items they no longer match (FR12; answered by Nick Hirst, 2026-11-10).
