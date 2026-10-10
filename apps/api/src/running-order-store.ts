import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId, RunningOrder } from "@app/shared";

/** Where running order versions live. Each version is a complete, never-edited snapshot. */
export interface RunningOrderStore {
  latest(productionId: string): Promise<RunningOrder | undefined>;
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
      try {
        // "wx" creates the file only if it doesn't exist, so two saves can't both win.
        await writeFile(join(folder, `v${order.version}.json`), JSON.stringify(order, null, 2), {
          flag: "wx",
        });
        return "saved";
      } catch (error) {
        if (hasCode(error, "EEXIST")) return "conflict";
        throw error;
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
