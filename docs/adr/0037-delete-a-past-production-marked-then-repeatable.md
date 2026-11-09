# 0037. Deleting a past production: marked first, done in the request, repeatable

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: Nick Hirst

## Context

FR22 lets an admin delete a past production for good, because it's mostly children's data (UK GDPR). It is held in three places: one partition, `PROD#<id>`, which every store writes to (ADR 0015); bucket keys `<id>/<item id>/<department>/<name>` (ADR 0030, 0032); and a row in the list (ADR 0036). They can't go in one atomic step, and the API function stops at 10 seconds. The danger is a delete that stops part way, leaving a production that looks complete but isn't, or data nobody can see. A real production is an estimated 1,000 rows and a few hundred files; the schema's caps allow several thousand rows.

## Options considered

1. **Mark it, delete, then remove the row, in the request**: no new resource; a stop at any point is visible and can be repeated / the list row gains a marker, and a production near the caps may need a second go.
2. **Row first, then the data**: simplest / a failure leaves children's data with no row, so nobody can see or finish it. The worst outcome for FR22.
3. **Data first, row last, no marker**: repeatable / a failure leaves a listed production, open to everyone, part-emptied and looking complete.
4. **A background job (Step Functions, SQS, a Lambda invoking itself)**: copes with any size / a new resource and progress-polling in the page, for about 40 batches of writes.
5. **Expiry (the table's time-to-live, an S3 lifecycle rule)**: no delete loop / every row must still be written, and both lag by up to days after the admin is told it's gone.

## Decision

We will use option 1: `DELETE /api/productions/{productionId}`, admin-only, run in the request, in this order.

1. **Refuse** with no change if the list doesn't hold it (404) or it's the newest. This stays in the API because ADR 0036 relies on the list never emptying. No lock is needed: only the top row could make a past production newest, and it can never be removed.
2. **Mark** its row (`deleting: true`), written only if the row exists. `productions` in the list then leaves it out, so nobody can open it and it can't count as the newest; a new `deleting` field names it for the Productions page, whose only action on it is Delete, with the same confirmation.
3. **Files**: each department's store runs its existing `keepOnlyItems(id, [])`, which lists the production and deletes only that department's keys.
4. **Partition**: one store operation Queries `pk = PROD#<id>` (consistent, keys only, following pages), and sends `BatchWriteItem` deletes of 25, retrying `UnprocessedItems` a few times, then failing. Never a Scan. Everything in the partition goes, so a new kind of data joins by itself.
5. **Row**: removed last, so it's gone only once everything is.

**A stop is safe.** Every step can be repeated, and a timeout is treated like any other failure: no time budget, no continuation token. The marker stays, the page says it didn't finish, and Delete again carries on, each attempt getting further. A marked id isn't refused as unknown. The id is never reused, as a new production must be later than the newest (FR19).

**Access**: no IAM change. `s3:ListBucket` and `s3:DeleteObject` on `*/*/{scenery,sfx,wardrobe}/*`, and the table's read-write grant, already cover this. `s3:DeleteObjectVersion` isn't needed, as the bucket has no versioning. Filtering to department keys stays inside that grant.

**Backup window: 7 days.** The bucket has no versioning, replication or backup, so its window is none (ADR 0030): a file goes at once. The table's point-in-time recovery keeps 7 days, the longer, so the confirmation says "up to 7 days". `packages/shared` holds the number once, and the stack and the confirmation both read it, leaving the template unchanged.

**Left alone**: usage is the `USAGE` partition, so it stays until its own expiry (FR22, ADR 0023). Accounts are in Cognito, which this function has no grant to reach (FR23).

**First read**: this story adds `attribute_not_exists(pk)` to the Dynamo store's first-read Put of 2027, as ADR 0036 says ("if absent") and `start` does. An unconditional Put could wipe a marker, making a partly deleted 2027 look complete. The window is tiny, the fix one line.

**Locally**: the file stores behave the same, under the shared contract suites (ADR 0016): the marker in `productions.json`, the folder stores' `keepOnlyItems`, then `<DATA_DIR>/<id>/` and `<DATA_DIR>/files/<id>/` removed.

## Consequences

- **Easier**: nothing to run at deploy beyond the generated route. New stores and departments are covered without touching the delete.
- **Harder**:
  - The list's row now holds a marker as well as a year, and the Productions page has a "not finished" state.
  - `pnpm dev` starts as an admin on the real table, so a delete there is real.
  - A file put by hand outside a department's folder stays, and so does a console folder placeholder: the API has no right to delete them, and the app never writes them.
  - An upload form signed in the 5 minutes before a production stops being the newest could land after its delete. It needs a new production started and the old one deleted within minutes; accepted.
- **Revisit if**: productions regularly need more than one attempt; or the bucket gains versioning or backups, or the table's recovery period changes, as the window then changes.
