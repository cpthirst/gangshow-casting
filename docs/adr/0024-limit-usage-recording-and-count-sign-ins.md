# 0024. Limit usage recording at API Gateway, and count a session per sign-in

- **Status**: Accepted
- **Date**: 2026-10-24
- **Deciders**: Nick Hirst

## Context

ADR 0023 opened `POST /api/usage` to every role, and the app now records each session, menu page, Overview view, item page and export. Each record is two DynamoDB writes: the recording-since marker and the event.

The E1.S1 security review found that nothing limits how often one account can record (OWASP A04). An app sending records in a loop would:
- **inflate the counts:** that person's numbers would no longer mean anything;
- **slow the Usage page:** a 90-day read adds up every record in the range;
- **add to the bill:** every record costs two writes.

The PRD's Security NFR now says one account can't flood the records.

Sessions have a related problem. Today a session is recorded every time the app opens or reloads while someone is signed in (FR1 as first written), so reloads make the counts noisy. The user changed FR1 on 2026-10-24: a session is one sign-in. A sign-in lasts as long as the web client's 1-day refresh token, so a reload or reopen within the day is part of the same session.

## Options considered

1. **A throttle on the usage route at API Gateway, and sessions recorded on sign-in.** API Gateway HTTP API stages take per-route throttling on top of the stage default (ADR 0017: 20 requests a second, burst 40). A tighter limit on `POST /api/usage` refuses the excess with 429 before it reaches Lambda or DynamoDB.
   - Pros: no new resource, no code in the request path, and it caps writes and cost.
   - Cons: the limit is shared by all callers, not per account. A flooding account can push other people's recordings into the limit, but those are ignored by the app anyway (FR3), and nobody else's work is affected.
2. **Write records under fixed keys per person, event and time slot, so repeats overwrite.** Per-account and exact, and it needs no infra change.
   - Cons: it changes the row keys in ADR 0023, it under-counts real repeat use within a slot, and it doesn't cap writes or cost.
3. **A per-account counter in DynamoDB, checked before each write.** Exact per account.
   - Cons: an extra read and write on every record, more code, and the same cost problem.
4. **AWS WAF rate-based rules.** Per client IP.
   - Cons: WAF costs about $5 a month plus per-request charges, which is a big share of the budget. IP isn't the account, and the team often shares one rehearsal Wi-Fi.

## Decision

We will use option 1, chosen by the user on 2026-10-24.

- **Throttle:** the API stage gets route settings for `POST /api/usage` of 5 requests a second with a burst of 10, shared by all callers. Every other route keeps the stage default.
  - **Why that limit:** a person makes a handful of records a minute in normal use, and the limit is well above what about 30 accounts can produce together.
  - **What's refused:** requests over the limit get 429 from API Gateway and are not recorded. The app already ignores failed recordings (FR3).
- **Sessions:** the app records a session only when someone returns from the login pages signed in. Reopening or reloading the app within the day's sign-in records none. After the refresh token runs out, the next use needs a sign-in, which records a new session.
  - **Locally:** `pnpm dev` and `pnpm demo` have no sign-in, so they still record a session each time the app opens.
- This amends ADR 0023's routes (adding the limit) and ADR 0017's limits (adding one route setting). Neither ADR's other decisions change.

## Consequences

- **Easier:**
  - The worst case is bounded: at most 5 records a second, about 430,000 a day, and only while someone keeps flooding.
  - Session counts mean sign-ins, which is what admins asked to see.
- **Harder:**
  - **Shared limit:** one flooding account can crowd out everyone's recordings until it stops, and it still adds rows up to the limit.
  - **A different meaning:** sessions recorded before this change counted reloads, so older counts run higher until they expire, 90 days after release.
  - **Testing:** the limit is enforced only by API Gateway, so it's tested with infra assertions, not by calling the handler.
- **Revisit if:**
  - someone does flood the records, so per-account limits become worth their cost;
  - the team grows enough that 5 a second is reached in normal use.
