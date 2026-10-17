import { randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId, RunningOrder } from "@app/shared";
import { hasCode, ifExists } from "./files.ts";

/** Where running order versions live. Each version is a complete, never-edited snapshot. */
export interface RunningOrderStore {
  latest(productionId: string): Promise<RunningOrder | undefined>;
  /** One saved version. Not used by a route yet; kept so old versions stay recoverable (FR11). */
  get(productionId: string, version: number): Promise<RunningOrder | undefined>;
  /** Saves a new version; "conflict" if that version number already exists. */
  save(order: RunningOrder): Promise<"saved" | "conflict">;
}

const newest = (versions: RunningOrder[]) =>
  versions.reduce<RunningOrder | undefined>(
    (best, order) => (best === undefined || order.version > best.version ? order : best),
    undefined,
  );

export function inMemoryRunningOrderStore(initial: RunningOrder[] = []): RunningOrderStore {
  const versions = [...initial];
  const ofProduction = (productionId: string) =>
    versions.filter((order) => order.productionId === productionId);
  const find = (productionId: string, version: number) =>
    ofProduction(productionId).find((order) => order.version === version);

  return {
    latest: async (productionId) => newest(ofProduction(productionId)),
    get: async (productionId, version) => find(productionId, version),
    async save(order) {
      // Checked and saved with no await between, so two saves of a version can't both win.
      if (find(order.productionId, order.version)) return "conflict";
      versions.push(order);
      return "saved";
    },
  };
}

// The id becomes a folder name: never trust callers to have checked it.
function versionsFolder(dataDir: string, productionId: string) {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  return join(dataDir, productionId, "running-order");
}

/** Every saved version number of a production's running order in the files, lowest first,
 *  for copying them elsewhere (remote-data FR8). */
export async function savedVersions(dataDir: string, productionId: string) {
  const files = (await ifExists(() => readdir(versionsFolder(dataDir, productionId)))) ?? [];
  return versionsIn(files).sort((a, b) => a - b);
}

/** Local files: `<dataDir>/<productionId>/running-order/v<version>.json`. */
export function fileRunningOrderStore(dataDir: string): RunningOrderStore {
  const folderFor = (productionId: string) => versionsFolder(dataDir, productionId);

  async function get(productionId: string, version: number) {
    const file = join(folderFor(productionId), `v${version}.json`);
    const text = await ifExists(() => readFile(file, "utf8"));
    return text === undefined ? undefined : RunningOrder.parse(JSON.parse(text));
  }

  return {
    async latest(productionId) {
      const files = (await ifExists(() => readdir(folderFor(productionId)))) ?? [];
      const version = Math.max(0, ...versionsIn(files));
      return version === 0 ? undefined : get(productionId, version);
    },
    get,
    async save(order) {
      const folder = folderFor(order.productionId);
      await mkdir(folder, { recursive: true });
      // Write in full to a temp file, then link it into place: readers never see a
      // half-written version, and link fails if the version exists, so two saves can't both win.
      const temp = join(folder, `.${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(order, null, 2));
      try {
        await link(temp, join(folder, `v${order.version}.json`));
        return "saved";
      } catch (error) {
        if (hasCode(error, "EEXIST")) return "conflict";
        throw error;
      } finally {
        await unlink(temp);
      }
    },
  };
}

function versionsIn(files: string[]) {
  return files.flatMap((file) => {
    const match = /^v(\d+)\.json$/.exec(file);
    return match ? [Number(match[1])] : [];
  });
}
