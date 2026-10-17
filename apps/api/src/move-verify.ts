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

/** Everything a production holds, read the way the app reads it: through the API's own
 *  handlers, plus every running order version from the store (no route reads old ones). */
async function readThroughApi(
  stores: Readable,
  productionId: string,
): Promise<Record<Collection, ById>> {
  const event = { pathParameters: { productionId } };
  const body = async (response: Promise<APIGatewayProxyStructuredResultV2>) => {
    const { statusCode, body: text } = await response;
    return statusCode === 200 ? JSON.parse(text ?? "") : undefined;
  };

  const castBody = await body(createGetCast(stores.cast)(event));
  const cast = castBody === undefined ? [] : CastList.parse(castBody).members;
  const roles = RoleList.parse(await body(createGetRoles(stores.roles)(event))).roles;
  const notes = ItemNoteList.parse(await body(createGetItemNotes(stores.itemNotes)(event))).notes;
  const latestBody = await body(createGetRunningOrder(stores.runningOrders)(event));
  const latest = latestBody === undefined ? 0 : RunningOrder.parse(latestBody).version;
  const versions: ById = new Map();
  for (let version = 1; version <= latest; version++) {
    const order = await stores.runningOrders.get(productionId, version);
    if (order) versions.set(String(version), order);
  }

  return {
    cast: new Map(cast.map((member) => [String(member.id), member])),
    roles: new Map(roles.map((role) => [String(role.id), role])),
    "item notes": new Map(notes.map((note) => [note.itemId, note])),
    "running order versions": versions,
  };
}

// Numeric ids in number order, others alphabetically, so reports read naturally.
const byId = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/**
 * Checks the remote database returns everything the files hold, read through the API from
 * both. Passes only if every local record is there and the same. Names records by
 * collection and id only, never their contents.
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
    passed: true,
    counts: {},
    problems: [],
    remoteOnly: [],
  };

  for (const collection of COLLECTIONS) {
    const records = mine[collection];
    const remoteRecords = theirs[collection];
    let matching = 0;
    for (const id of [...records.keys()].sort(byId)) {
      if (!remoteRecords.has(id)) result.problems.push(`${collection}: ${id} missing`);
      else if (!isDeepStrictEqual(records.get(id), remoteRecords.get(id))) {
        result.problems.push(`${collection}: ${id} differs`);
      } else matching++;
    }
    if (records.size > 0) result.counts[collection] = matching;
    for (const id of [...remoteRecords.keys()].sort(byId)) {
      if (!records.has(id)) result.remoteOnly.push(`${collection}: ${id}`);
    }
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
