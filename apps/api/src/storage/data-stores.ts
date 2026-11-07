import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FileDepartment } from "@app/shared";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoRoleStore } from "#/casting/roles/dynamo-role-store.ts";
import { fileRoleStore } from "#/casting/roles/role-store.ts";
import {
  dynamoItemNoteStore,
  MIC_PLOT_NOTE,
  PROPS_NOTE,
  SCENERY_NOTE,
  SFX_NOTE,
  WARDROBE_NOTE,
} from "#/item-notes/dynamo-item-note-store.ts";
import {
  fileItemNoteStore,
  MIC_PLOT_NOTES_FILE,
  PROPS_NOTES_FILE,
  SCENERY_NOTES_FILE,
  SFX_NOTES_FILE,
  WARDROBE_NOTES_FILE,
} from "#/item-notes/item-note-store.ts";
import {
  folderItemFileStore,
  type ItemFileStore,
  type ItemFileStores,
} from "#/production/item-files/item-file-store.ts";
import { s3ItemFileStore } from "#/production/item-files/s3-item-file-store.ts";
import { dynamoMicPlotStore } from "#/production/mic-plot/dynamo-mic-plot-store.ts";
import { fileMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { dynamoPropStore } from "#/production/props/dynamo-prop-store.ts";
import { filePropStore } from "#/production/props/prop-store.ts";
import { fileCastStore } from "#/show/cast/cast-store.ts";
import { dynamoCastStore } from "#/show/cast/dynamo-cast-store.ts";
import { dynamoRemoveCastMember } from "#/show/cast/dynamo-remove-cast-member.ts";
import { uncastThenRemove } from "#/show/cast/remove-cast-member.ts";
import { dynamoRunningOrderStore } from "#/show/running-order/dynamo-running-order-store.ts";
import { fileRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { ItemCleanup } from "#/show/running-order/save-running-order.ts";
import { dynamoUsageStore } from "#/usage/dynamo-usage-store.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { documentClient } from "./dynamo-table.ts";

// Git-ignored: real production data never goes in the repo (CLAUDE.md safeguarding).
const defaultDataDir = fileURLToPath(new URL("../../data", import.meta.url));

/**
 * Where the API keeps each production's data, from its environment:
 * - DATA_DIR: the local data folder (default apps/api/data);
 * - DATA_TABLE: the remote table, if any (remote-data FR4), which then holds everything;
 * - DATA_TABLE_REGION: the table's region, default London, where infra deploys it. Not
 *   AWS_REGION, so a shell set up for other AWS work can't point the API elsewhere.
 * - FILES_BUCKET: the bucket for scenery, SFX and Wardrobe files, if any (ADR 0030), always in London.
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
    props: filePropStore(dataDir),
    propsNotes: fileItemNoteStore(dataDir, PROPS_NOTES_FILE),
    sceneryNotes: fileItemNoteStore(dataDir, SCENERY_NOTES_FILE),
    sfxNotes: fileItemNoteStore(dataDir, SFX_NOTES_FILE),
    wardrobeNotes: fileItemNoteStore(dataDir, WARDROBE_NOTES_FILE),
    micPlotNotes: fileItemNoteStore(dataDir, MIC_PLOT_NOTES_FILE),
    micPlots: fileMicPlotStore(dataDir),
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
    props: dynamoPropStore(db, table),
    propsNotes: dynamoItemNoteStore(db, table, PROPS_NOTE),
    sceneryNotes: dynamoItemNoteStore(db, table, SCENERY_NOTE),
    sfxNotes: dynamoItemNoteStore(db, table, SFX_NOTE),
    wardrobeNotes: dynamoItemNoteStore(db, table, WARDROBE_NOTE),
    micPlotNotes: dynamoItemNoteStore(db, table, MIC_PLOT_NOTE),
    micPlots: dynamoMicPlotStore(db, table),
  };
}

/** The stores that hold the show's data rather than an item's: everything else is per item. */
export const showWideStores = [
  "runningOrders",
  "cast",
  "removeCastMember",
] as const satisfies readonly (keyof Stores)[];

/**
 * Every kind of data kept per item, by name, which a cut removes (CLAUDE.md, "Cutting an item
 * takes all its data with it"): every store but the show-wide ones, and each department's
 * files. A new store joins by itself.
 */
export function itemCleanupOf(stores: Stores, files: ItemFileStores): ItemCleanup {
  // Typed without the show-wide stores, so a per-item store that can't keep only the items
  // still in the show fails the typecheck here.
  const perItem: Omit<Stores, (typeof showWideStores)[number]> = stores;
  const showWide = new Set<string>(showWideStores);
  return Object.fromEntries([
    ...Object.entries(perItem).filter(([kind]) => !showWide.has(kind)),
    ...Object.entries(files).map(([department, store]) => [`${department}Files`, store] as const),
  ]);
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

/**
 * Where usage is kept: the remote table when there is one, otherwise only in memory. Never
 * in the files, and never in Stores, so moving the show's data never copies it (ADR 0023).
 */
export function usageStore(env: Env = process.env) {
  const remote = remoteTableFrom(env);
  return remote ? dynamoUsageStore(remote.db, remote.table) : inMemoryUsageStore();
}

/** A store for each department's files, all kept the same way. */
const storesFor = (storeOf: (department: FileDepartment) => ItemFileStore): ItemFileStores => ({
  scenery: storeOf("scenery"),
  sfx: storeOf("sfx"),
  wardrobe: storeOf("wardrobe"),
});

/**
 * Where scenery, SFX and Wardrobe files are kept: the bucket FILES_BUCKET names, otherwise a folder
 * beside the local files, laid out the same way (ADR 0030, ADR 0032). Apart from the table, so
 * pnpm dev can use the remote table before the bucket exists.
 */
export function itemFileStores(env: Env = process.env) {
  const bucket = env.FILES_BUCKET;
  if (bucket) {
    const region = "eu-west-2";
    const s3 = new S3Client({ region });
    return {
      stores: storesFor((department) => s3ItemFileStore(s3, bucket, department)),
      where: `scenery, SFX and Wardrobe files in bucket ${bucket} (${region})`,
      folder: undefined,
    };
  }
  const folder = join(dataDirFrom(env), "files");
  return {
    stores: storesFor((department) => folderItemFileStore(folder, department)),
    where: `scenery, SFX and Wardrobe files in ${folder}`,
    folder,
  };
}
