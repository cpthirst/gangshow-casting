# 0023. Usage records in the data table, recorded through our own API

- **Status**: Accepted
- **Date**: 2026-10-24
- **Deciders**: Nick Hirst

## Context

The usage-tracking PRD has the app record each team member's sessions and their use of pages, Overview views, item pages and exports. Admins see this on a Usage page.

The PRD sets these constraints:
- **Retention:** records are kept for 90 days (FR9).
- **No failures shown:** a failed recording never shows (FR3).
- **Admins only:** only admins can read the records (FR4).
- **No outside services:** no third-party analytics, since the app makes no requests to other sites.

Two existing decisions stand in the way:
- **ADR 0018:** the only data about the team is each account's username. Usage records add what each person did and when, which is personal data about adult volunteers under UK GDPR.
- **ADR 0020:** the API refuses every route that isn't a read for a Read-Only Team Member. Recording a session writes a record, so their sessions would be refused (usage-tracking.E1.S1 AC3).

## Options considered

1. **Our own API and the existing table.** The page sends each event to a new route, and the API stores it in the production data table (ADR 0015) with an expiry time.
   - Pros: no new AWS resource, the existing grants are enough, and DynamoDB deletes expired rows itself. Who did something comes from the sign-in token, as for every other route.
   - Cons: usage shares a table with casting data. The table needs time-to-live switched on, which changes the stack.
2. **A separate usage table.** As option 1, but in a table of its own.
   - Pros: usage is kept apart from casting data, and it has its own backups and settings.
   - Cons: a new resource, a new grant and a new table name to configure. Its point-in-time recovery would keep usage longer than 90 days unless it's switched off.
3. **CloudWatch logs or metrics.** The API logs each event, and the Usage page queries the logs.
   - Pros: no table rows.
   - Cons: log queries are slow and charged per query. Retention is per log group, not per record. Logs are the wrong place for data the app reads back.
4. **A third-party analytics service.**
   - Cons: it breaks the no-other-sites rule, sends team data to an outside processor, and still needs our own access control.

## Decision

We will use option 1.

- **Routes:**
  - `POST /api/usage` records one event. Its body names only the event (`session`, a menu page, an Overview view, an item by production and item id, or an export), checked against a fixed list in the shared schemas. The username always comes from the sign-in token, never from the body. It answers 204.
  - `GET /api/usage?days=7|30|90` is admin-only. It returns each username's sessions and use counts, totals per feature and the activity list for the range.
- **Read-only exception to ADR 0020:** `POST /api/usage` goes in a new, separate list of routes open to every role. It is not added to ADR 0021's "reads sent as POST", because it does store something. It can only add a usage record about the caller, so it widens nothing a read-only member can change.
- **Rows:**
  - **Events:** `pk = USAGE` and `sk = <ISO timestamp>#<random id>`, with `username`, `event`, the event's details and `expiresAt` (epoch seconds, 90 days on). A range is one query on `sk`, newest first. The random id keeps events in the same millisecond apart. All usage shares one partition, because at about 30 accounts it stays far below DynamoDB's partition limits.
  - **Recording-since marker:** one row, `pk = USAGE` and `sk = SINCE`. It is written once with the date of the first event, never expires and holds no personal data.
- **Expiry:** the table gets time-to-live on `expiresAt`. DynamoDB can take a day or two to delete a row, so reads also skip anything older than 90 days.
- **Every account listed:** the data function has no user-pool access (ADR 0018). The Usage page therefore merges the account list it already gets from `GET /api/accounts` with the usage by username. No new grant is needed.
- **The page never waits on recording:** the page sends events without awaiting them and ignores failures. It sends no events in the browser tests.
- **Local:** `pnpm dev` and `pnpm demo` keep usage in memory against the made-up local accounts, as accounts are. Usage never reaches the remote table from a local run.
- This amends ADR 0018's "no new personal data" about the team: each account's usage is added, kept 90 days, and readable only by admins. Its other decisions stand.

## Consequences

- **Easier:**
  - No new AWS resource or grant.
  - Usage follows the same store pattern as cast and roles: an in-memory store for tests and local runs, and a DynamoDB store for the hosted app.
  - The 90-day rule needs no clean-up job.
- **Harder:**
  - **Backups and restores:** point-in-time recovery and on-demand backups of the table, such as `gangshow-manual-2026-10-19`, can hold usage rows past 90 days. A restored table brings back usage rows that have since expired, until DynamoDB deletes them again.
  - **Counting:** counts are added up in the function on each read, not kept as counters.
  - **Telling the team:** the maintainer must tell the team their use is recorded (PRD Constraints).
- **Revisit if:**
  - a 90-day read stops being one quick query (many more accounts, or far more events per person);
  - usage needs its own retention or backup rules, which would call for option 2;
  - the team asks to see or remove their own records.
