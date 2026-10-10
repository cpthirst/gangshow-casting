---
id: running-order.E1.S1
title: View the running order
epic: E1
status: ready
---

## Story

As a production team member, I want to see the whole running order on screen, so that the meeting works from one current version instead of a circulated document.

## Acceptance criteria

### AC1: Both halves are shown with their items in order
Given the 2027 running order has "Curtain Up" and "Pirate Panic" in the first half and "Big Finish" in the second half
When I open the Running order page
Then I see a "First half" table listing "Curtain Up" then "Pirate Panic"
And a "Second half" table listing "Big Finish"

### AC2: Each item shows its details
Given "Pirate Panic" has cast "Cubs + Beavers", stage Apron then Full then Apron, leads "Sam / Alex", comments "Performed to track" and 18 minutes
When I open the Running order page
Then its row shows "Cubs + Beavers", "Apron / Full / Apron", "Sam / Alex", "Performed to track" and "18"

### AC3: The current version is shown
Given the latest saved running order is version 6
When I open the Running order page
Then I see "Draft 6"

### AC4: Numbering skips items not in the printed programme
Given the first half holds "Curtain Up" (printed), "Producers' Call" (not printed) and "Pirate Panic" (printed)
When I open the Running order page
Then "Curtain Up" is numbered 1 and "Pirate Panic" is numbered 2
And "Producers' Call" has no number and is marked "Not in printed programme"

### AC5: Numbering restarts in the second half
Given the second half's first printed item is "Big Finish"
When I open the Running order page
Then "Big Finish" is numbered 1

### AC6: No running order yet
Given no running order has been saved for 2027
When I open the Running order page
Then I see "No running order yet"

### AC7: The running order can't be loaded
Given the API is unreachable
When I open the Running order page
Then I see "Couldn't load the running order"

### AC8: The API returns the latest version
Given versions 5 and 6 of the 2027 running order are stored
When a client requests GET /api/productions/2027/running-order
Then the response is 200 with version 6, in a body that satisfies the shared running order schema

### AC9: The API reports an unknown production
Given nothing is stored for production "1999"
When a client requests GET /api/productions/1999/running-order
Then the response is 404

## Notes

- FRs: FR1, FR2, FR12
- Depends on: none
- Walking skeleton for the feature: shared zod schema → file-backed store (behind a storage interface, with an in-memory version for tests) → GET handler → page.
- Data shape: one document per version, holding the production, title, version, saved time, show start time and interval minutes, plus halves, each with items. An item has a stable id, title, cast, stage (a sequence of apron or full), leads, comments, minutes (or none) and printed. Numbers are calculated, never stored.
- Draft 6 (FR12): convert `GS 2027 DRAFT PROGRAMME v6` by hand into the local, git-ignored data folder (`apps/api/data/`). "Comments / Squad" splits into leads and comments. Tests use made-up items only.
- Out of scope: timings and clock (E1.S2), any changes (E2, E3).
