import { isDeepStrictEqual } from "node:util";
import type { ItemNoteList, RunningOrder } from "@app/shared";
import { type DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { readCastFile } from "./cast-store.ts";
import { castKey } from "./dynamo-cast-store.ts";
import { noteKey } from "./dynamo-item-note-store.ts";
import { roleNameKey, roleRow } from "./dynamo-role-store.ts";
import { versionKey } from "./dynamo-running-order-store.ts";
import { META, partitionFor, queryAll, written } from "./dynamo-table.ts";
import { fileItemNoteStore } from "./item-note-store.ts";
import { readRoleFile } from "./role-store.ts";
import { fileRunningOrderStore, savedVersions } from "./running-order-store.ts";

/** Everything a production holds in the local files (remote-data FR8). */
export interface LocalProduction {
  productionId: string;
  cast: Awaited<ReturnType<typeof readCastFile>>;
  roles: Awaited<ReturnType<typeof readRoleFile>>;
  notes: ItemNoteList;
  versions: RunningOrder[];
}

export async function readLocalProduction(
  dataDir: string,
  productionId: string,
): Promise<LocalProduction> {
  const store = fileRunningOrderStore(dataDir);
  const versions: RunningOrder[] = [];
  for (const version of await savedVersions(dataDir, productionId)) {
    const order = await store.get(productionId, version);
    if (order) versions.push(order);
  }
  return {
    productionId,
    cast: await readCastFile(dataDir, productionId),
    roles: await readRoleFile(dataDir, productionId),
    notes: await fileItemNoteStore(dataDir).list(productionId),
    versions,
  };
}

/** A row of the production data table. */
export type Row = Record<string, unknown> & { pk: string; sk: string };

// As DynamoDB stores it: optional fields left out are simply absent.
const asStored = (row: Row): Row => JSON.parse(JSON.stringify(row));

/** The rows the remote database should hold for a production, keyed as the remote stores
 *  key them, with every id, revision and version number kept. */
export function rowsOf(local: LocalProduction): Row[] {
  const pk = partitionFor(local.productionId);
  return [
    ...(local.cast?.list.members ?? []).map((member) => ({
      pk,
      sk: castKey(member.id),
      ...member,
    })),
    ...local.roles.list.roles.flatMap((role) => [
      roleRow(local.productionId, role),
      { pk, sk: roleNameKey(role), roleId: role.id },
    ]),
    ...local.notes.notes.map((note) => ({ pk, sk: noteKey(note.itemId), ...note })),
    ...local.versions.map((order) => ({ ...order, pk, sk: versionKey(order.version) })),
  ].map(asStored);
}

const collections: [prefix: string, name: string][] = [
  ["CAST#", "cast"],
  ["ROLENAME#", "role names"],
  ["ROLE#", "roles"],
  ["NOTE#", "item notes"],
  ["RO#", "running order versions"],
];

/** A row's collection and id, as reports name it: never its contents. */
function labelOf(row: Row) {
  const [prefix, collection] = collections.find(([p]) => row.sk.startsWith(p)) ?? ["", "other"];
  const id = row.sk.slice(prefix.length).replace(/^0+(?=\d)/, "");
  return { collection, id };
}

export interface CopyPlan {
  toWrite: Row[];
  alreadyThere: Row[];
  /** "collection: id" for each row the remote database holds differently. */
  differing: string[];
}

/** What a copy would do, given what the remote database already holds. Rows only it holds,
 *  such as notes saved there, are left alone. */
export function planCopy(rows: Row[], remote: Row[]): CopyPlan {
  const remoteByKey = new Map(remote.map((row) => [row.sk, asStored(row)]));
  const plan: CopyPlan = { toWrite: [], alreadyThere: [], differing: [] };
  for (const row of rows) {
    const there = remoteByKey.get(row.sk);
    if (!there) plan.toWrite.push(row);
    else if (isDeepStrictEqual(there, row)) plan.alreadyThere.push(row);
    else {
      const { collection, id } = labelOf(row);
      plan.differing.push(`${collection}: ${id}`);
    }
  }
  return plan;
}

export interface CopyReport {
  productionId: string;
  outcome: "copied" | "refused";
  counts: Record<string, { copied: number; alreadyThere: number }>;
  differing: string[];
}

function countsOf(plan: CopyPlan) {
  const counts: CopyReport["counts"] = {};
  const tally = (rows: Row[], key: "copied" | "alreadyThere") => {
    for (const row of rows) {
      const { collection } = labelOf(row);
      const count = counts[collection] ?? { copied: 0, alreadyThere: 0 };
      count[key]++;
      counts[collection] = count;
    }
  };
  tally(plan.toWrite, "copied");
  tally(plan.alreadyThere, "alreadyThere");
  return counts;
}

/**
 * Copies a production's local data into the remote table: only rows that aren't there yet,
 * each written only if still absent. If the table holds any row differently, it writes
 * nothing at all. The id counters move on to where the files' would be, never back.
 */
export async function copyProduction(
  db: DynamoDBDocumentClient,
  tableName: string,
  local: LocalProduction,
): Promise<CopyReport> {
  const remote = (await queryAll(db, tableName, local.productionId, "")).filter(
    (row): row is Row => typeof row.pk === "string" && typeof row.sk === "string",
  );
  const plan = planCopy(rowsOf(local), remote);
  const { productionId } = local;
  if (plan.differing.length > 0) {
    return { productionId, outcome: "refused", counts: {}, differing: plan.differing };
  }

  for (const row of plan.toWrite) {
    await db.send(
      new PutCommand({
        TableName: tableName,
        Item: row,
        ConditionExpression: "attribute_not_exists(sk)",
      }),
    );
  }
  if (local.cast) await moveCounterOn(db, tableName, productionId, "castNextId", local.cast.nextId);
  await moveCounterOn(db, tableName, productionId, "lastRoleId", local.roles.nextId - 1);
  return { productionId, outcome: "copied", counts: countsOf(plan), differing: [] };
}

/** Sets a META counter to `value`, unless it's already there or beyond. */
async function moveCounterOn(
  db: DynamoDBDocumentClient,
  tableName: string,
  productionId: string,
  counter: "castNextId" | "lastRoleId",
  value: number,
) {
  await written(() =>
    db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: META },
        UpdateExpression: "SET #counter = :value",
        ConditionExpression: "attribute_not_exists(#counter) OR #counter < :value",
        ExpressionAttributeNames: { "#counter": counter },
        ExpressionAttributeValues: { ":value": value },
      }),
    ),
  );
}

/** The copy's report, as lines for the maintainer: collections, ids and counts only. */
export function copyReportLines(report: CopyReport): string[] {
  if (report.outcome === "refused") {
    return [
      `Nothing copied: the remote database already holds different data for production ${report.productionId}.`,
      ...report.differing.map((label) => `Differs: ${label}`),
    ];
  }
  return [
    `Copied production ${report.productionId} to the remote database.`,
    ...Object.entries(report.counts).map(
      ([collection, { copied, alreadyThere }]) =>
        `${collection}: ${copied} copied, ${alreadyThere} already there`,
    ),
  ];
}
