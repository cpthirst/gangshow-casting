# 0015. DynamoDB for production data

- **Status**: Accepted
- **Date**: 2026-10-17
- **Deciders**: Nick Hirst

## Context

All data lives in git-ignored JSON files under `apps/api/data/<productionId>/`, behind four store interfaces. Each has an in-memory twin for tests. Before the app can be hosted (ADR 0005, 0006), these stores need a managed AWS database. This ADR picks one. It doesn't decide hosting, sign-in or access control: ADR 0010 still requires an access-control ADR before any cast data is hosted.

The choice rests on how the code reads and writes data, not on the data being JSON today.

### Where data is persisted

| Store | File | Shape | History |
|---|---|---|---|
| `CastStore` ([cast-store.ts](../../apps/api/src/cast-store.ts)) | `cast.json` | `{productionId, members[], nextId}` | None: deletes are permanent (ADR 0010) |
| `RoleStore` ([role-store.ts](../../apps/api/src/role-store.ts)) | `roles.json` | `{productionId, roles[], nextId}`, each role holding `castMemberIds[]` | None |
| `ItemNoteStore` ([item-note-store.ts](../../apps/api/src/item-note-store.ts)) | `item-notes.json` | `{productionId, notes[]}`, keyed by `itemId` | None |
| `RunningOrderStore` ([running-order-store.ts](../../apps/api/src/running-order-store.ts)) | `running-order/v<N>.json` | One immutable snapshot per version | Every version kept (running-order FR11) |

Writes go through `writePrivateFile` (atomic rename, owner-only, temp-file sweep) and are serialised by `oneAtATime()` ([private-file.ts](../../apps/api/src/private-file.ts)). Its own comment says this "only holds within one process … a hosted store needs its own guarantee". The browser keeps no data: there is no `localStorage` or IndexedDB in `apps/web/src`, and unsaved running-order edits live only in Vue state.

### Access patterns found

1. **Every read loads a whole collection for one production.** The four GET routes ([routes.ts](../../apps/api/src/routes.ts)) return the full cast list, all roles, all notes, or the latest running order. No route reads one entity by id, and none has paging, filters or query parameters.
2. **Filtering, sorting, search and aggregation all happen in the browser**, over those full lists:
   - sort by surname then first name, and accent-free substring search (`sortCast`, `filterCast`, `searchCast` in [web/src/cast.ts](../../apps/web/src/cast.ts));
   - role ordering and per-item counts (`sortRoles`, `roleCounts` in [web/src/roles.ts](../../apps/web/src/roles.ts));
   - back-to-back, timing and quick-change clashes, joining roles to running-order positions ([web/src/clashes.ts](../../apps/web/src/clashes.ts));
   - per-person part counts (`overview.ts`), and running times (`runningClock` in [web/src/running-order.ts](../../apps/web/src/running-order.ts)).

   Pages fetch the collections in parallel (for example `CastingItemPage.vue:99-101`). The server does no joins, range queries or text search.
3. **"Latest version"** is the one ordered read: the highest `v<N>` in a folder (`latest()` in the running-order store). `get(version)` exists but no route uses it yet.
4. **Single-entity writes with optimistic concurrency.** Cast members, roles and notes carry a `revision`. Update and delete succeed only at the expected revision, otherwise "stale" (409). Notes use revision 0 for "none yet".
5. **Append-only versions with conflict detection.** Saving a running order writes `v<N+1>`, and fails if it exists (`link` → `EEXIST`, [running-order-store.ts](../../apps/api/src/running-order-store.ts)). The handler first checks `baseVersion === latest.version` ([save-running-order.ts](../../apps/api/src/save-running-order.ts)).
6. **Per-production id counters that never reuse an id** (`nextId` in the cast and role files).
7. **A uniqueness rule**: role names are unique within an item, ignoring case (`sameRoleName`, checked inside the serialised write in `withNewRole` / `withUpdatedRole`).
8. **Relationships, checked by the application:**
   - a role belongs to an item in the latest running order;
   - `castMemberIds` must be members of the production's cast;
   - a note belongs to an item in the latest running order.

   [add-role.ts](../../apps/api/src/add-role.ts), [update-role.ts](../../apps/api/src/update-role.ts) and [save-item-note.ts](../../apps/api/src/save-item-note.ts) check these by reading before they write. Nothing makes the check and the write atomic.
9. **One multi-record change that should succeed or fail together.** Deleting a cast member must also remove them from every role (casting-roles FR9, ADR 0010). [delete-cast-member.ts](../../apps/api/src/delete-cast-member.ts) works around having no transaction: it uncasts, deletes, then uncasts again.
10. **Write frequency is low and bursty**: a few people saving during or after a rehearsal (running-order PRD risks: "two people editing in the same meeting").

### Data shape and volume

- **Per production**: about 56–60 cast members (ADR 0010; the demo has 60), about 40 roles (demo: 39) and about 20–25 items. The demo's three live files total about 22 KB.
- **Schema caps**: 1,000 members, 2,000 roles, 200 people per ensemble, and 100 items per half (`packages/shared`).
- **Running-order versions**: about 5 KB each, kept forever. The worst case under the schema caps is about 340 KB.
- **Total**: well under 10 MB per production per year, even with hundreds of versions.
- **Scope**: one production (2027) is in use, and everything is keyed by production. No pattern crosses productions.

### What the code doesn't say (assumptions)

The constraints for users, budget and existing AWS services were not given, so:
- **Users**: about 5–20 production-team volunteers, rarely more than 3–5 at once. Heaviest use is in the evenings and around rehearsals, with long idle periods.
- **Budget**: a volunteer-run charity, so close to zero, and ideally nothing when idle.
- **AWS in use**: none. The CDK stack is empty (`infra/lib/app-stack.ts`). ADR 0006 points to Lambda behind an API Gateway HTTP API, which this ADR assumes. The running-order PRD already names DynamoDB as "the expected choice".
- **Region**: a UK region (eu-west-2), for UK GDPR comfort.
- **Retention**: past productions are kept, but are not queried across.

## Options considered

1. **DynamoDB (on-demand), one table, one item per entity.**
   - Fits patterns 1–7 directly:
     - `Query` on the production key for each collection;
     - a reverse `Query` with limit 1 for the latest version;
     - condition expressions for revisions, "version doesn't exist yet" and unique-name markers;
     - atomic counters.
   - `TransactWriteItems` (up to 100 items) makes pattern 9 atomic.
   - No VPC, connections or patching. IAM-scoped access from Lambda. Costs pennies a month at this traffic, and nothing when idle.
   - Cons:
     - Ad-hoc queries, joins and reporting are awkward.
     - Relationships stay enforced in code, not by the database.
     - Transactions cap at 100 items, so a 200-person "Add all cast" ensemble can't have a check per member.
     - Reads are eventually consistent unless you ask for strong consistency.
2. **Aurora Serverless v2 or RDS PostgreSQL (JSONB where useful).**
   - Pros:
     - Foreign keys and `ON DELETE CASCADE` enforce patterns 8 and 9 in the database.
     - A unique index on `(production, item, lower(name))` covers pattern 7.
     - Transactions have no item limit, and SQL covers any future reporting.
   - Cons:
     - It brings a VPC, subnets and security groups, plus connection management from Lambda (RDS Proxy or the Data API), schema migrations, and engine upgrades.
     - Cost at low traffic: RDS `db.t4g.micro` is about $15/month after the free year. Aurora Serverless v2 is about $45/month at its 0.5 ACU floor. Aurora can now pause at 0 ACU, but then the first request after idle waits seconds to resume, which is bad for a volunteer at rehearsal.
     - The relational strengths go unused, because the server never joins or aggregates (pattern 2).
3. **DocumentDB.**
   - Pros: stores the current documents almost unchanged, and Mongo-style queries are available.
   - Cons:
     - It's VPC-only and instance-based: about $55+/month for the smallest instance, even when idle. A serverless capacity mode exists, but still has a minimum charge.
     - It needs TLS bundles and drivers in Lambda, and has the same operational load as option 2.
     - Its query power goes unused, and it doesn't fix pattern 9 any better than DynamoDB does.
4. **Keep files, for example in S3.**
   - Pros: no database to run.
   - Cons: S3 conditional writes can cover patterns 5 and 6, but per-entity revisions and multi-record atomicity mean rebuilding a database by hand.

**Rough costs** (approximate, eu-west-2, to verify at decision time): DynamoDB well under $1/month, RDS PostgreSQL about $15/month, Aurora Serverless v2 about $0–45/month, DocumentDB $55+/month.

## Decision

We will use **Amazon DynamoDB in on-demand mode**: one table for all production data, with one item per entity.

**Keys**
- Partition key: `PROD#<productionId>`.
- Sort keys: `CAST#<id>`, `ROLE#<id>`, `NOTE#<itemId>`, `RO#<zero-padded version>`, `META` (id counters and the latest version number), and `ROLENAME#<itemId>#<normalised name>` (uniqueness markers).
- No secondary indexes yet: every read is one `Query` on one partition.

**Concurrency**
- Revision checks use `ConditionExpression`.
- Version saves use `attribute_not_exists`, together with a condition on `META.latestVersion = baseVersion`, in one transaction.
- Reads that a write depends on use `ConsistentRead`.

**Atomic changes**
- A cast member's delete and their uncasting from every role run in one `TransactWriteItems` call. The current two-pass sequence is kept only as a fallback past 99 roles.
- A role's put and its name marker go in one transaction.
- Ids come from an atomic counter. A gap left by a failed write is fine, because ids only need never to be reused.

**Data layer**
- New `dynamo*Store` implementations of the four existing interfaces. The in-memory stores stay for tests.
- `CastStore` gains a "remove and uncast" operation that the delete handler calls instead of coordinating two stores.
- Handlers and `packages/shared` are otherwise unchanged.

The table, its IAM grants and its backups arrive with the hosting story, through the infra review.

**Amended 2026-10-17, as built (remote-data E1 and E2):**
- The table and its 7-day backups arrived with remote-data, ahead of hosting: the API still runs on the maintainer's machine (ADR 0010). IAM grants still wait for hosting.
- Running order versions need no META counter. A version is saved only if its row doesn't exist yet, and "latest" is the newest row by key, so one condition does both jobs.
- `META` holds `castNextId` (which also marks that a production has a cast list) and `lastRoleId`.
- A role's name row is keyed on a SHA-256 of its item id and normalised name (`ROLENAME#<hash>`), so any valid name makes a short, safe key.
- Deleting a cast member is one `RemoveCastMember` operation, not a `CastStore` method: the transaction, then a sweep for roles cast meanwhile.
- A running order version is one item, so DynamoDB's 400 KB item limit caps it. Today's orders are about 5 KB; the schema's worst case is close to the limit (see Revisit if).

## Consequences

**Easier**
- No servers, VPC or connection pool to run.
- Close to zero cost.
- The store interfaces map one-to-one onto it, so the change stays inside `apps/api`.
- Concurrency rules the file stores could only enforce within one process now hold across Lambdas.
- Pattern 9 becomes atomic.

**Harder**
- Relationships (patterns 8 and 9) stay enforced in application code, and need tests against DynamoDB Local or a test table, not only the in-memory stores.
- A transaction can't check that each of up to 200 ensemble members exists, so membership is still checked by reading before writing. The delete's uncast sweep is the safety net.
- Any reporting means an export or a new index.
- **Backups and GDPR**: point-in-time recovery and backups keep a deleted child's data for up to 35 days. ADR 0010 says deletion is permanent and no copies are kept, so the access-control/hosting ADR must decide the retention window and record it in the privacy notice.

**Revisit if**
- A running order nears DynamoDB's 400 KB item limit (many items with every free-text field full): split versions across items, or cap the schema in bytes.
- The team needs **queries across productions** (returning cast, year-on-year stage time) or ad-hoc **reporting or exports** run on the server.
- Filtering, search or clash detection **moves to the server**, for example because casts grow into the thousands, or pages start needing one entity or paged results instead of whole collections.
- **Restoring an old running order** (FR11's "recover") has to re-map roles and notes across many items in one change. A change touching more than 100 items needs relational transactions.
- The relationships multiply (rehearsal schedules, costumes and availability linked to people and items), so the integrity rules kept in code outweigh what the database would enforce.
- An **audit trail or history** of casting changes is wanted. That contradicts ADR 0010 today, so it needs its own decision.
- The organisation standardises on a relational database or needs portability off AWS.
