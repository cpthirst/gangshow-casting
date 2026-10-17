import { isDeepStrictEqual } from "node:util";
import { CastList, ItemNoteList, RoleList, RunningOrder } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { CastStore } from "./cast-store.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { createGetRoles } from "./get-roles.ts";
import { createGetRunningOrder } from "./get-running-order.ts";
import type { ItemNoteStore } from "./item-note-store.ts";
import type { RoleStore } from "./role-store.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

/** The stores a verification reads through: the files' or the remote table's. */
export interface Readable {
  cast: CastStore;
  roles: RoleStore;
  itemNotes: ItemNoteStore;
  runningOrders: RunningOrderStore;
}

export interface Verification {
  productionId: string;
  passed: boolean;
  /** How many records of each collection match. */
  counts: Record<string, number>;
  /** "collection: id missing|differs" for each record the remote database doesn't match. */
  problems: string[];
  /** "collection: id" for each record only the remote database holds: kept, not a failure. */
  remoteOnly: string[];
}

type ById = Map<string, unknown>;

/** What a verification compares, in the order it reports them. */
const COLLECTIONS = ["cast", "roles", "item notes", "running order versions"] as const;
type Collection = (typeof COLLECTIONS)[number];

/** A handler's JSON body, parsed by the caller's schema; undefined for 404, which the cast
 *  and running order answer when a production has none. Anything else is a failure. */
async function bodyOf(response: Promise<APIGatewayProxyStructuredResultV2>): Promise<unknown> {
  const { statusCode, body } = await response;
  if (statusCode === 404) return undefined;
  if (statusCode !== 200) throw new Error(`The API answered ${String(statusCode)}`);
  return JSON.parse(body ?? "");
}

/** Every saved version of the running order, up to the latest, by version number. No
 *  route reads old versions, so they're read from the store. */
async function versionsOf(stores: Readable, productionId: string, latest: number) {
  const versions: ById = new Map();
  for (let version = 1; version <= latest; version++) {
    const order = await stores.runningOrders.get(productionId, version);
    if (order) versions.set(String(version), order);
  }
  return versions;
}

const keyedBy = <T>(records: T[], idOf: (record: T) => string | number): ById =>
  new Map(records.map((record) => [String(idOf(record)), record]));

/** Everything a production holds, read the way the app reads it: through the API's own
 *  handlers. */
async function readThroughApi(
  stores: Readable,
  productionId: string,
): Promise<Record<Collection, ById>> {
  const event = { pathParameters: { productionId } };
  const castBody = await bodyOf(createGetCast(stores.cast)(event));
  const latestBody = await bodyOf(createGetRunningOrder(stores.runningOrders)(event));
  const latest = latestBody === undefined ? 0 : RunningOrder.parse(latestBody).version;
  return {
    cast: keyedBy(castBody === undefined ? [] : CastList.parse(castBody).members, (m) => m.id),
    roles: keyedBy(
      RoleList.parse(await bodyOf(createGetRoles(stores.roles)(event))).roles,
      (r) => r.id,
    ),
    "item notes": keyedBy(
      ItemNoteList.parse(await bodyOf(createGetItemNotes(stores.itemNotes)(event))).notes,
      (note) => note.itemId,
    ),
    "running order versions": await versionsOf(stores, productionId, latest),
  };
}

// Numeric ids in number order, others alphabetically, so reports read naturally.
const sortedIds = (records: ById) =>
  [...records.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

/** One collection compared: how many match, what's missing or different, what's extra. */
function compareCollection(collection: Collection, local: ById, remote: ById) {
  const problems: string[] = [];
  let matching = 0;
  for (const id of sortedIds(local)) {
    if (!remote.has(id)) {
      problems.push(`${collection}: ${id} missing`);
      continue;
    }
    if (!isDeepStrictEqual(local.get(id), remote.get(id))) {
      problems.push(`${collection}: ${id} differs`);
      continue;
    }
    matching++;
  }
  const remoteOnly = sortedIds(remote)
    .filter((id) => !local.has(id))
    .map((id) => `${collection}: ${id}`);
  return { matching, problems, remoteOnly };
}

/**
 * Checks the remote database returns everything the files hold, read through the API from
 * both. Passes only if the files hold something, and every record of it is there and the
 * same. Names records by collection and id only, never their contents.
 */
export async function verifyCopy(
  local: Readable,
  remote: Readable,
  productionId: string,
): Promise<Verification> {
  const mine = await readThroughApi(local, productionId);
  const theirs = await readThroughApi(remote, productionId);
  const result: Verification = {
    productionId,
    passed: false,
    counts: {},
    problems: [],
    remoteOnly: [],
  };

  for (const collection of COLLECTIONS) {
    const { matching, problems, remoteOnly } = compareCollection(
      collection,
      mine[collection],
      theirs[collection],
    );
    if (mine[collection].size > 0) result.counts[collection] = matching;
    result.problems.push(...problems);
    result.remoteOnly.push(...remoteOnly);
  }
  // Nothing local means a mistyped id or the wrong folder, never a proven copy.
  if (COLLECTIONS.every((collection) => mine[collection].size === 0)) {
    result.problems.push("nothing in the files to compare");
  }
  result.passed = result.problems.length === 0;
  return result;
}

/** The verification, as lines for the maintainer: collections, ids and counts only. */
export function verificationLines(result: Verification): string[] {
  if (!result.passed) {
    return [
      `Verification failed for production ${result.productionId}. Copy again, then verify again.`,
      ...result.problems,
    ];
  }
  return [
    `Verified production ${result.productionId}: the remote database returns everything the files hold.`,
    ...Object.entries(result.counts).map(([collection, count]) => `${collection}: ${count} match`),
    ...result.remoteOnly.map((label) => `Only in the remote database (kept): ${label}`),
  ];
}
