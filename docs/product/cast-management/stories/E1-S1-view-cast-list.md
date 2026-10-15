---
id: cast-management.E1.S1
title: View the cast list
epic: E1
status: in-progress
---

## Story

As a member of the production team, I want to see the whole cast list in the app, so that everyone works from one current list instead of a shared spreadsheet.

## Acceptance criteria

### AC1: The Cast page lists every cast member
Given the 2027 cast has "Sam Example" (Scouts, "1st Somewhere") and "Alex Sample" (Explorers, "Riverside ESU")
When I open the Cast page
Then I see a row for each, showing first name, last name, section and group

### AC2: The list is sorted by last name, then first name
Given the cast has "Zoe Adams", "Ben Carter" and "Amy Carter"
When I open the Cast page
Then the rows read "Zoe Adams", "Amy Carter", "Ben Carter"

### AC3: The number of cast members is shown
Given the cast has 3 members
When I open the Cast page
Then I see "3 cast members"

### AC4: Missing details are shown as not set
Given "Alex Sample" has no section and no group
When I open the Cast page
Then their section shows "Not set" and their group is blank

### AC5: No cast list yet
Given no cast list has been saved for 2027
When I open the Cast page
Then I see "No cast members yet"

### AC6: The cast list can't be loaded
Given the API is unreachable
When I open the Cast page
Then I see "Couldn't load the cast list"

### AC7: The API returns the production's cast
Given the 2027 cast list is stored
When a client requests GET /api/productions/2027/cast
Then the response is 200 with a body that satisfies the shared cast list schema

### AC8: The API reports a production with no cast
Given nothing is stored for production "1999"
When a client requests GET /api/productions/1999/cast
Then the response is 404

## Notes

- FRs: FR1, FR8
- Depends on: none.
- Walking skeleton: shared zod schema → store → GET handler → Cast page, which replaces the placeholder.
- **Storage** (story map "Persistence"):
  - a storage interface, with an in-memory version for tests;
  - a file version that reads `apps/api/data/<productionId>/cast.json` (git-ignored);
  - members have a numeric `id`, `firstName`, `lastName`, `section` (`scouts` | `explorers` | `network` | null), `group` and `revision`.
- **Fields (ADR 0010):** first and last name up to 40 characters, group up to 60. The schema allows no other personal data.
- **Starting list (FR8):** convert `docs/product/cast-management/cast.csv` (git-ignored) once into the local data file. "Scout" maps to scouts, "Explorer" to explorers, and blanks to not set. Keep the CSV's IDs. Tests use made-up names only.
- **Privacy:** no names in server logs or error messages.
- Out of scope: filtering (E1.S2), and any changes (E2).
