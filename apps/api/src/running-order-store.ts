import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { RunningOrder } from "@app/shared";

/** Where running order versions live. Each version is a complete, never-edited snapshot. */
export interface RunningOrderStore {
  latest(productionId: string): Promise<RunningOrder | undefined>;
}

// Production ids become folder names, so keep them to a safe alphabet.
export const isValidProductionId = (id: string) => /^[a-z0-9-]{1,40}$/i.test(id);

const newest = (versions: RunningOrder[]) =>
  versions.reduce<RunningOrder | undefined>(
    (best, order) => (best === undefined || order.version > best.version ? order : best),
    undefined,
  );

export function inMemoryRunningOrderStore(versions: RunningOrder[] = []): RunningOrderStore {
  return {
    latest: async (productionId) =>
      newest(versions.filter((order) => order.productionId === productionId)),
  };
}

/** Local files: `<dataDir>/<productionId>/running-order/v<version>.json`. */
export function fileRunningOrderStore(dataDir: string): RunningOrderStore {
  return {
    async latest(productionId) {
      if (!isValidProductionId(productionId)) throw new Error("Invalid production id");
      const dir = join(dataDir, productionId, "running-order");
      const version = Math.max(0, ...versionsIn(await listFiles(dir)));
      if (version === 0) return undefined;
      const text = await readFile(join(dir, `v${version}.json`), "utf8");
      return RunningOrder.parse(JSON.parse(text));
    },
  };
}

async function listFiles(dir: string) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function versionsIn(files: string[]) {
  return files.flatMap((file) => {
    const match = /^v(\d+)\.json$/.exec(file);
    return match ? [Number(match[1])] : [];
  });
}
