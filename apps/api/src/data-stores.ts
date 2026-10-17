import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fileCastStore } from "./cast-store.ts";
import { dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoItemNoteStore } from "./dynamo-item-note-store.ts";
import { dynamoRemoveCastMember } from "./dynamo-remove-cast-member.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
import { dynamoRunningOrderStore } from "./dynamo-running-order-store.ts";
import { documentClient } from "./dynamo-table.ts";
import { fileItemNoteStore } from "./item-note-store.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";
import { fileRoleStore } from "./role-store.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

// Git-ignored: real production data never goes in the repo (CLAUDE.md safeguarding).
const defaultDataDir = fileURLToPath(new URL("../data", import.meta.url));

/**
 * Where the API keeps each production's data, from its environment:
 * - DATA_DIR: the local data folder (default apps/api/data);
 * - DATA_TABLE: the remote table, if any (remote-data FR4), which then holds everything;
 * - DATA_TABLE_REGION: the table's region, default London, where infra deploys it. Not
 *   AWS_REGION, so a shell set up for other AWS work can't point the API elsewhere.
 * The AWS SDK reads the credentials and profile itself.
 */
type Env = Record<string, string | undefined>;

/** The local data folder: DATA_DIR, or apps/api/data. */
export const dataDirFrom = (env: Env) => env.DATA_DIR ?? defaultDataDir;

/** The remote table DATA_TABLE names, with a client for it; undefined if none is set. */
export function remoteTableFrom(env: Env) {
  const table = env.DATA_TABLE;
  if (!table) return undefined;
  const region = env.DATA_TABLE_REGION ?? "eu-west-2";
  return { table, region, db: documentClient(new DynamoDBClient({ region })) };
}

/** Every store, kept in the local files. */
export function fileStores(dataDir: string) {
  const cast = fileCastStore(dataDir);
  const roles = fileRoleStore(dataDir);
  return {
    runningOrders: fileRunningOrderStore(dataDir),
    cast,
    roles,
    removeCastMember: uncastThenRemove(cast, roles),
    itemNotes: fileItemNoteStore(dataDir),
  };
}

/** Every store the API's routes use. */
export type Stores = ReturnType<typeof fileStores>;

/** Every store, kept in the remote table. */
export function remoteStores(db: DynamoDBDocumentClient, table: string): Stores {
  return {
    runningOrders: dynamoRunningOrderStore(db, table),
    cast: dynamoCastStore(db, table),
    roles: dynamoRoleStore(db, table),
    removeCastMember: dynamoRemoveCastMember(db, table),
    itemNotes: dynamoItemNoteStore(db, table),
  };
}

export function dataStores(env: Env = process.env) {
  const remote = remoteTableFrom(env);
  if (remote) {
    return {
      ...remoteStores(remote.db, remote.table),
      where: `everything in table ${remote.table} (${remote.region})`,
    };
  }
  const dataDir = dataDirFrom(env);
  return { ...fileStores(dataDir), where: `everything in files at ${dataDir}` };
}
