import { randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId, RunningOrder } from "@app/shared";

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
  const get = async (productionId: string, version: number) =>
    ofProduction(productionId).find((order) => order.version === version);

  return {
    latest: async (productionId) => newest(ofProduction(productionId)),
    get,
    async save(order) {
      if (await get(order.productionId, order.version)) return "conflict";
      versions.push(order);
      return "saved";
    },
  };
}

/** Local files: `<dataDir>/<productionId>/running-order/v<version>.json`. */
export function fileRunningOrderStore(dataDir: string): RunningOrderStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const folderFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "running-order");
  };

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

async function ifExists<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (hasCode(error, "ENOENT")) return undefined;
    throw error;
  }
}

const hasCode = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;

function versionsIn(files: string[]) {
  return files.flatMap((file) => {
    const match = /^v(\d+)\.json$/.exec(file);
    return match ? [Number(match[1])] : [];
  });
}
