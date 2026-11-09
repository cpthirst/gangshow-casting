# 0036. The list of productions is rows in the data table

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: Nick Hirst

## Context

The app shows one production, `"2027"`, named once in `apps/web/src/utils/production.ts`. Epic 5 of `simplify` needs a list: everyone opens the newest (FR20), an admin starts a new one by year (FR19) and deletes a past one (FR22). Nothing records which productions exist. Every API route already takes the production in its address, each production is one partition (`PROD#<id>`, ADR 0015), and the file stores use one folder per production. The hosted table holds 2027, which must appear in the list without a risky migration, and deploys are the maintainer's.

## Options considered

1. **Rows in the existing table, and a file locally**: an admin can start one from the app, and a conditional write enforces "must not already exist"; no new AWS resource, and the table's backups cover it / 2027 needs a way in (below).
2. **A list in code or deploy config**: nothing to store or migrate / each new production needs a release, so an admin can't start one (FR19). It would serve E5.S1 only, then be thrown away.
3. **Derive it from what's stored**: nothing new to keep in step / a new production has no rows to find, so it needs a marker row, which is option 1. In DynamoDB it also means a Scan of every row, children's names included (no store scans today), or a new index and a backfill. A half-finished delete (E5.S4) would still be listed.

How 2027 gets in, given option 1:

- **a. Written by the first read that finds the list empty**: nothing for the maintainer to do, and demo, e2e and new tables all work the same way / a read that can write, once.
- **b. Always listed, from a constant**: no write / brings 2027 back after E5.S4 deletes it.
- **c. A one-off command after deploying** (as `account roles` was): no special case in the code / until it's run, the deployed app has no production to open. Every new table, the demo and e2e need it too.
- **d. A CDK custom resource at deploy**: automatic / a new kind of AWS resource for one row.

## Decision

We will hold the list as **one row per production in the existing table**: `pk = "PRODUCTIONS"`, `sk = <id>`, a partition of its own like `USAGE`. Locally, a `productions.json` in the data folder, written as the other file stores are. A new store, with a shared contract suite (ADR 0016), reads with a consistent Query and starts one with a conditional Put.

**The id is the year**: a four-digit string, as `"2027"` already is. It is shown as it stands, with no separate name, so 2027's partition, folders and files don't change. Starting a production checks for four digits; the looser `ProductionId` pattern stays for addresses.

**The newest is the highest year, worked out by one shared function.** No row or flag says which is current, so there's nothing to set that could reopen a past production (FR21).

**2027 gets in by option a.** Every read of the list goes through the store's `list`. If that finds no rows, it writes `2027` if absent, and returns it. Simultaneous first reads write the same row. It can only happen once per store: the newest can't be deleted (FR22), so the list never empties again, and a deleted 2027 stays deleted. E5.S4 must keep that refusal in the API. `2027` becomes a constant in that store and leaves the web app.

## Consequences

- **Easier**: no migration, and nothing to run at deploy. `GET /api/productions` is hosted and token-guarded by being added to `routes.ts`. There is no new table, index or IAM grant: the only infra change is that generated route. A row holds only a year, no personal data.
- **Harder**:
  - One GET can write, once, and a brand-new table lists an empty 2027 (as the web app assumes today).
  - `production.ts` stays the one place, but must learn the production when the app loads, so paths built from it at import (`CAST_PATH` and others) become calls, and `one-production.test.ts` changes.
  - Each new production needs its empty cast list written as it starts (E5.S2): today a production without one answers 404 and refuses additions.
  - Two admins starting different years at once both succeed. The higher is simply the newest.
- **Revisit if**: productions need more than a year (a name, a date), or two shows in one year; a year is then no longer a usable id.
