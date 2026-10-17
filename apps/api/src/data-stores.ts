import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fileCastStore } from "./cast-store.ts";
import { dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoItemNoteStore } from "./dynamo-item-note-store.ts";
import { dynamoRemoveCastMember } from "./dynamo-remove-cast-member.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
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
 * - DATA_TABLE: the remote table, if any (remote-data FR4). Item notes move first; the other
 *   stores follow in later stories;
 * - DATA_TABLE_REGION: the table's region, default London, where infra deploys it. Not
 *   AWS_REGION, so a shell set up for other AWS work can't point the API elsewhere.
 * The AWS SDK reads the credentials and profile itself.
 */
export function dataStores(env: Record<string, string | undefined> = process.env) {
  const dataDir = env.DATA_DIR ?? defaultDataDir;
  const files = `files at ${dataDir}`;
  const stores = { runningOrders: fileRunningOrderStore(dataDir) };

  const table = env.DATA_TABLE;
  if (!table) {
    const cast = fileCastStore(dataDir);
    const roles = fileRoleStore(dataDir);
    return {
      ...stores,
      cast,
      roles,
      removeCastMember: uncastThenRemove(cast, roles),
      itemNotes: fileItemNoteStore(dataDir),
      where: `everything in ${files}`,
    };
  }

  const region = env.DATA_TABLE_REGION ?? "eu-west-2";
  const db = documentClient(new DynamoDBClient({ region }));
  return {
    ...stores,
    cast: dynamoCastStore(db, table),
    roles: dynamoRoleStore(db, table),
    removeCastMember: dynamoRemoveCastMember(db, table),
    itemNotes: dynamoItemNoteStore(db, table),
    where: `item notes, cast and roles in table ${table} (${region}); everything else in ${files}`,
  };
}
