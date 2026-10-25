import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId, PropList } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";

/** Where each production's props live (stage-props FR13): the production's own, apart from
 *  its casting. Adding, editing and removing come with the stories that need them. */
export interface PropStore {
  /** Every item's props; none until the first is added. */
  list(productionId: string): Promise<PropList>;
}

const empty = (productionId: string): PropList => ({ productionId, props: [] });

/** Props held in memory, starting with those given: for tests. */
export function inMemoryPropStore(saved: PropList[] = []): PropStore {
  const lists = new Map(saved.map((list) => [list.productionId, list]));
  return { list: async (productionId) => lists.get(productionId) ?? empty(productionId) };
}

/** Local file: `<dataDir>/<productionId>/props.json` (git-ignored), created with the first
 *  prop. */
export function filePropStore(dataDir: string): PropStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "props.json");
  };

  return {
    async list(productionId) {
      const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
      if (text === undefined) return empty(productionId);
      const parsed = PropList.safeParse(parseJson(text));
      if (!parsed.success || parsed.data.productionId !== productionId) {
        throw new Error(`Props file for production ${productionId} is invalid`);
      }
      return parsed.data;
    },
  };
}
