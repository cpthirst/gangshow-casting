---
feature: casting-rules
status: approved
owner: cpthirst
date: 2026-10-16
---

# Casting rules: PRD

## Problem

The production team can now cast every item, but nothing tells them when the casting doesn't work on the night. A young person cast in two items in a row has no time to change costume or get from the wings to their next entrance. One who comes back on only a few minutes after going off is rushed, and one with a little more time still needs a quick change planned. Today the team has to spot these by reading the running order against each item's roles in their heads, and clashes are found late, at rehearsal. Back-to-back appearances are one of the two things CLAUDE.md names as core to the app.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting | See straight away which casting choices clash, and how badly, while they're choosing |
| Production team reordering the show | See which clashes a new running order creates or clears |
| Section leaders | See which of their young people have a clash anywhere in the show |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| No clash goes unnoticed | Clashes in the latest saved running order and casting that aren't flagged | 0 |
| The person at fault is obvious | Clicks from an item's page to see who clashes and with which item | 0 |
| Problems are visible from every casting view | Items, item pages and people with a clash that show no icon on the Items, item and Overview pages | 0 |
| Severity is clear | Clashes shown at the wrong severity (FR2–FR5) | 0 |
| The rules can be tried safely | Steps to get a full demo show running with every kind of clash, using no real data | 1 command |

## Non-goals

- **Showing clashes on the Running order page.** Reordering is how many clashes get fixed, but icons there are a later step. For now the team checks the casting pages after saving.
- **Blocking anything.** Clashes never stop anyone saving a running order or casting a role. They are information.
- **Suggesting or making fixes**, such as proposing a better order or another cast member.
- **Uneven stage time** (who is on stage too much or too little). That's a separate rule for a later PRD; the Overview already shows how much each person is cast.
- **Marking a clash as accepted** or hiding it once the team has decided it's fine.
- **Changing the rules' settings** in the app (for example, the 5- and 8-minute gaps).
- **Costumes, quick-change areas, or stage entrances and exits.** The rules only know the running order, item lengths and casting.

## Shared terms

These build on the casting terms in [../README.md](../README.md).

- **Appearance**: a cast member appears in an item if they're cast in at least one of its roles.
- **Their part in an item**: the biggest role size they hold in that item (lead, then support, cameo, ensemble). A person who is a lead and also in the ensemble of the same item counts as a lead there.
- **Named part**: lead, support or cameo, as opposed to ensemble.
- **Gap**: for two appearances one after the other, the total length of the items performed between them. If the interval falls between them, its length counts too.
- **Clash**: a back-to-back, timing or quick-change finding for one person between two of their appearances, at one of three severities: **error**, **warning** or **info** (most to least serious). A clash belongs to the person and to both items.

## Functional requirements

- **FR1**: The rules must use the production's latest saved running order (item order, halves, item lengths and the interval) and the current casting, the same data as the other casting pages. They are checked again whenever a casting page is opened or refreshed.
- **FR2**: **Back-to-back, both named parts: ERROR.** A person who appears in two items performed one straight after the other in the same half, with a named part in both, has a back-to-back **error**. For example: Cameo then Lead, Lead then Support, or Support then Lead.
- **FR3**: **Back-to-back with an ensemble: WARNING.** If their part in either of the two items is ensemble, it's a back-to-back **warning** instead. Ensemble costume and entrances are more flexible. For example: Lead then Ensemble, Ensemble then Cameo, or Ensemble then Ensemble.
- **FR4**: **Too little time between appearances: WARNING.** A person whose gap between one appearance and their next is less than **5 minutes** has a timing **warning**. This applies whatever their parts are. Back-to-back appearances are reported by FR2 or FR3 only, not also as a timing warning.
- **FR5**: **Quick change: INFO.** A person whose gap is at least **5 minutes** but less than **8 minutes** has a quick-change **info**, so the team can plan the change. For example, a gap of exactly 5 minutes is info, and a gap of exactly 8 minutes needs nothing. This applies whatever their parts are.
- **FR6**: Only appearances one after the other count: each appearance is compared with that person's next appearance in the show. The first item of the second half follows the last item of the first half, with the interval as part of the gap (so with an interval of 8 minutes or more, appearances either side of it never clash).
- **FR7**: **Item page.** On an item's casting page, every cast member with a clash involving that item must have an icon next to their name, wherever their name appears, ensemble members included. The icon shows the severity. Its description says what the clash is and names both items, so it reads the same on either item's page. For example: "Error: back-to-back. Lead in 'Pirate Sketch', then Support in 'Woodland Dance'", or "Warning: short gap. Only 4 minutes between 'Sketch Two' and 'Campfire Song' (needs at least 5 minutes)", or "Info: quick change. 6 minutes between 'Night Hike' and 'Finale'". Someone with more than one clash gets one icon at the worst severity, with every clash described.
- **FR8**: **Items list.** On the Items page, each item with at least one clash must show an icon at its worst severity. The description says how many errors, warnings and info it has and who is involved.
- **FR9**: **Overview.** On the Overview, each cast member with at least one clash anywhere in the show must show an icon at their worst severity. The description lists each clash with the items involved.
- **FR10**: **Seeing the description.** On larger screens the description appears on hover, and also on keyboard focus. On phones, where there's no hover, the description is written out under the icon, with no tap needed.
- **FR11**: Errors, warnings and info must each look different in shape as well as colour, and say "Error", "Warning" or "Info" in words. Each uses the same icon on all three pages.
- **FR12**: Fixing the cause clears the clash the next time the page is opened or refreshed. Causes include recasting a role, removing someone from it, or saving a running order that moves the items apart. No icon is left behind.
- **FR13**: If the running order or roles can't be loaded, the pages must not show anyone as clash-free. They keep their existing "couldn't load" messages, and no icons are shown.

## Non-functional requirements

- **Security and safeguarding**: clashes are worked out from data the app already holds. They add no new personal data and are never stored. Casting data stays for the production team only and is never publicly reachable (CLAUDE.md). Tests and demo data use made-up names only.
- **Accessibility**: WCAG 2.2 AA.
  - Severity is never shown by colour alone (FR11).
  - Every icon has an accessible name that includes the full description, and it can be reached and read by keyboard.
  - On phones the text is visible, with nothing to discover by hover.
  - Usable at 320px width with no sideways scrolling, including when descriptions are written out.
- **Performance**: for a show of about 30 items and a cast of about 200, with about 2,000 roles, the rules are checked and every page shows its icons in under 1 second locally.
- **UI consistency**: the icons sit where they fit the existing pages, using the shared icon and pill styles, with no new layout patterns (the casting-overview NFR). `ux-reviewer` checks this.
- **Demo data for trying the rules** (new):
  - **One command:** `pnpm demo` serves the whole app on a rich, made-up show. The production team and developers can see every kind of clash, then cause and fix clashes by using the app normally (recasting, reordering and saving).
  - **Contents:** a realistic full show, using only made-up names:
    - about 60 cast members across Scouts, Explorers, Network and no section;
    - two halves of about 10 items each, every item with a length, and an interval;
    - roles of every size, including large ensembles.
  - **Coverage:** at least one back-to-back error, one back-to-back warning, one timing warning and one quick-change info, alongside items and people with no clashes.
  - **Fresh each start:** every start begins from the committed demo set. Changes last until the demo is stopped, and restarting gets back to the known state.
  - **Runs alongside `pnpm dev`:** the demo uses its own ports. It never reads or writes the real data, and never shares its servers.
  - **Labelled:** every page clearly says it's showing demo data, so the demo can't be mistaken for the real show.

## Constraints and assumptions

- **Data**: built from the existing running order (item lengths, halves, interval) and roles. No new stored data is expected.
- **Item lengths**: the team will give every item a length. What happens when an item has none is an open question.
- **Fixed rules**: the 5- and 8-minute gaps and the severities are fixed in the app for now.
- **Unprinted items**: items left out of the printed programme are still performed, so they count in gaps and can clash.
- **Scope**: one production (2027). Casting never carries over between productions (CLAUDE.md).
- **Browser layout tests** (ADR 0011): whether to add the new icons and descriptions to them is the user's call, made when the stories are built.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Too many warnings or info, so they get ignored | M | M | The three severities look clearly different (FR11), and info is the quietest. The demo shows the balance before real use. Tune the 5- and 8-minute gaps with the team after first use |
| Item lengths are wrong or missing, so the timing warnings are wrong | M | M | Lengths are already shown and edited on the Running order page. See Open questions for missing lengths |
| Written-out descriptions make phone cards long | M | L | Keep descriptions to one short line per clash. The browser layout tests guard against sideways scrolling |
| The demo is mistaken for the real show | L | M | Separate ports, a fresh copy each start, and a label on every page |

## Open questions

- **Missing item lengths:** if an item between two appearances has no length, should it count as 0 minutes (flag a possible clash) or skip the check? Assumed not to happen, since the team will fill every length in. Owner: product (decide at story time).
- **Two parts in one item:** is it ever a problem to hold two parts in the same item (for example, a quick change mid-item)? Assumed not a clash. Owner: production team.
- **The 5- and 8-minute gaps:** are they right for every section? Owner: production team, after first use.
- **Info on the summary pages:** should a person or item whose only finding is quick-change info show an icon on the Items list and Overview, or only on the item page? Assumed yes, at info severity (FR8, FR9). Owner: product.
