---
id: casting-overview-grid.E3.S5
title: Build the casting grid's Excel file in the browser, as the Mic Plot is
epic: E3
status: draft
---

## Story

As the maintainer, I want the casting grid's Excel file built in the browser, as the Word exports and the Mic Plot workbook are, so that every export works one way and the API keeps no route that only turns data into a file.

## Acceptance criteria

### AC1: Export to Excel still downloads the same file
Given the Grid view of the Overview, with "Sam Taylor" cast as a Lead in "Pirate Sketch"
When anyone signed in chooses Export to Excel
Then a file named for the production and the day downloads, as before
And it holds the same headings, names, sections, role-size letters and colour fills as before

### AC2: Names stay text
Given a cast member whose first name is "=SUM(A1)"
When the grid is exported
Then the cell shows "=SUM(A1)" as text, not a formula

### AC3: The file is made without the API
Given the Grid view
When someone exports the grid
Then the page sends nothing to the API to make the file
And the use is still recorded on the Usage page as "Export: Excel grid"

### AC4: The old export route is gone
Given the API
When anyone sends a request to the casting grid's export route
Then it answers 404, as for any unknown route

### AC5: Read-only members can still change nothing
Given a Read-Only Team Member
When they try any change that isn't a read
Then the API refuses it with "You have read-only access.", now with no exception for exporting

### AC6: It says when the file can't be made
Given the file can't be made
When someone exports the grid
Then the page says "Couldn't export the grid. Try again." and nothing is saved or recorded

## Notes

- FRs: FR12, FR13, FR14 (unchanged in what the file holds).
- Raised at the maintainer's request during production-mics.E3.S2, which chose to build the Mic Plot workbook in the browser for consistency ([ADR 0033](../../../../../adr/0033-mic-plot-workbook-built-in-the-browser.md)).
- Needs a new ADR that supersedes [ADR 0019](../../../../../adr/0019-server-built-excel-export-for-admins.md) and [ADR 0021](../../../../../adr/0021-excel-export-for-every-team-role.md)'s server-built part, and amends the read-only rule's single exception.
- Where it reaches today: the `POST …/casting-grid/export` route in `apps/api/src/routes.ts`, its handler and test in `apps/api/src/casting/casting-grid/`, `packages/shared/src/casting-grid-export.ts` and `api-routes.ts`, `apps/web/src/services/casting-grid-export.ts`, the dev-server, Lambda and hosted-check tests that use the route, and `write-excel-file` in `apps/api/package.json`. The post-deploy check (`pnpm check:hosted`) stops trying the export.
- The web app's `utils/excel/xlsx.fixture.ts` can then replace the API's `casting-grid/xlsx.fixture.ts`.
- Likely over ~400 lines once tests move: split into "build it in the browser" and "remove the route" if so.
- Out of scope: any change to what the file holds or how it looks.
