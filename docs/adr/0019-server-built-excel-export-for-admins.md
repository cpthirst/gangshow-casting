# 0019. The casting grid's Excel export: built by the server, for admins only

- **Status**: Proposed
- **Date**: 2026-10-18
- **Deciders**: Nick Hirst

## Context

The casting-overview-grid PRD (FR12–FR14) lets an admin download the casting grid as an Excel file for planning meetings, sharing and printing. The file holds children's names, so it is a copy that sits outside the app's access control: once downloaded, nobody can revoke it. ADR 0010 limits the cast data we hold, and ADR 0018 says admin-only actions are enforced on the server, not only hidden in the page.

The repo has no spreadsheet library. The API runs as Lambda functions bundled by esbuild (ADR 0017), so any library adds to a bundle that is cold-started. The team is 5–20 volunteers and cost must stay close to £0.

## Options considered

1. **Build the file in the browser** from the cast, roles and running order the page already loaded: no API change, no Lambda weight. Cons: the data is already in every member's browser, so "admin-only" would only be a hidden button; a member could still run the same code, which fails the PRD's server-refusal requirement. It would also add a library to the web bundle.
2. **Build the file on the server, behind an admin-only route, with a small library (`write-excel-file`)**: the route sits in the shared admin-only list (ADR 0018), so the server refuses non-admins before any handler runs. `write-excel-file` is MIT, has one dependency (`fflate`), is about 1.8 MB unpacked, is actively released, and writes cell fills and plain values. Cons: a new dependency in the API bundle; the response is a binary body.
3. **Server-built with `exceljs`**: the best-known library. Cons: about 22 MB unpacked with nine dependencies and no release since December 2024. Far more than one sheet needs, and a heavier cold start.
4. **Server-built, writing the `.xlsx` XML ourselves and zipping it with `fflate`**: the smallest bundle and no spreadsheet library. Cons: about 100+ lines of file-format code (content types, styles, shared strings) for us to own and test.
5. **Don't offer an export**: the safest for the children's data, but the team can't take the grid to a meeting or print it.

## Decision

We will build the file on the server, with option 2.

- **Who may export, and why**: only admins, because the file is a copy of children's names outside the app's access control. A new route (`GET /api/productions/{productionId}/casting-grid.xlsx`) goes in the shared admin-only route list, so API Gateway's authorizer and `adminOnlyRefusal` refuse everyone else with a 403 and no file (ADR 0018). The page also hides the button from non-admins, but the server is what enforces it.
- **What the file may hold**: first name, last name, section, then one column per item in running order, with the role-size letter (L, S, C or E) and a matching colour fill in each filled cell. Nothing else: no group, age band, casting notes or role names (ADR 0010, ADR 0014). The file name is the production and the date, and carries no other detail.
- **Data**: the handler reads the same cast, roles and running order as the page and builds the rows in a plain, tested function, so the file and the on-screen grid cannot drift apart.
- **Hosting**: the route runs in the existing data Lambda, with no new AWS resource and no new permission. The response is a binary body, base64-encoded as API Gateway's HTTP API expects (`isBase64Encoded`). The page fetches it with the signed-in user's token and saves it as a file, so the token is never put in a URL.
- **Library**: `write-excel-file`, added to `apps/api` only, never to the web app. It runs without network calls.

## Consequences

- **Easier**: admin-only is enforced where the data lives; the export reuses the existing authorizer and admin list; the file's contents are one tested function.
- **Harder**: one more dependency in the API bundle to keep up to date, and a binary response through the API, which no route returns today. Every downloaded copy is outside our control, so the PRD asks for a "team only" note beside the button.
- **Revisit if**: the team wants non-admins to export (this ADR would be superseded, not edited); the API bundle or cold start grows noticeably; `write-excel-file` stops being maintained; or the file needs more than one sheet or richer formatting.
