import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CastList, ProductionId } from "@app/shared";
import { ifExists } from "./files.ts";

/** Where each production's cast list lives: one mutable document, no history (ADR 0010). */
export interface CastStore {
  list(productionId: string): Promise<CastList | undefined>;
}

export function inMemoryCastStore(initial: CastList[] = []): CastStore {
  const lists = [...initial];
  return {
    list: async (productionId) => lists.find((list) => list.productionId === productionId),
  };
}

/** Local file: `<dataDir>/<productionId>/cast.json` (git-ignored). */
export function fileCastStore(dataDir: string): CastStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "cast.json");
  };

  return {
    async list(productionId) {
      const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
      return text === undefined ? undefined : parseCastFile(text, productionId);
    },
  };
}

// Parse errors can quote the file, and the file holds children's names, so any problem
// becomes one fixed message with no cause attached: nothing from the file reaches a log.
function parseCastFile(text: string, productionId: string): CastList {
  const parsed = CastList.safeParse(parseJson(text));
  if (!parsed.success || parsed.data.productionId !== productionId) {
    throw new Error(`Cast file for production ${productionId} is invalid`);
  }
  return parsed.data;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
