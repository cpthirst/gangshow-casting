import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fileCastStore } from "./cast-store.ts";
import { dynamoItemNoteStore } from "./dynamo-item-note-store.ts";
import { documentClient } from "./dynamo-table.ts";
import { fileItemNoteStore } from "./item-note-store.ts";
import { fileRoleStore } from "./role-store.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

// Git-ignored: real production data never goes in the repo (CLAUDE.md safeguarding).
const defaultDataDir = fileURLToPath(new URL("../data", import.meta.url));

/**
 * Where the API keeps each production's data, from its environment:
 * - DATA_DIR: the local data folder (default apps/api/data);
 * - DATA_TABLE: the remote table, if any (remote-data FR4). Item notes move first; the other
 *   stores follow in later stories. AWS_REGION defaults to London, and the AWS SDK reads the
 *   credentials and profile itself.
 */
export function dataStores(env: Record<string, string | undefined> = process.env) {
  const dataDir = env.DATA_DIR ?? defaultDataDir;
  const files = `files at ${dataDir}`;
  const stores = {
    cast: fileCastStore(dataDir),
    roles: fileRoleStore(dataDir),
    runningOrders: fileRunningOrderStore(dataDir),
  };

  const table = env.DATA_TABLE;
  if (!table)
    return { ...stores, itemNotes: fileItemNoteStore(dataDir), where: `everything in ${files}` };

  const region = env.AWS_REGION ?? "eu-west-2";
  const db = documentClient(new DynamoDBClient({ region }));
  return {
    ...stores,
    itemNotes: dynamoItemNoteStore(db, table),
    where: `item notes in table ${table} (${region}); everything else in ${files}`,
  };
}
