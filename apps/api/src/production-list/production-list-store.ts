import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionList } from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { ifExists } from "#/storage/files.ts";
import { oneAtATime, writePrivateFile } from "#/storage/private-file.ts";

/**
 * Which productions exist (ADR 0036). `list` is the only way to read them, because it also
 * puts in the production that was already held before there was a list: FIRST_PRODUCTION.
 */
export interface ProductionListStore {
  /** Every production, in no particular order; an empty list becomes FIRST_PRODUCTION. */
  list(): Promise<ProductionList>;
}

/** Written by the first read that finds the list empty. The newest production can't be
 *  deleted, so the list never empties again and a deleted 2027 stays deleted (ADR 0036). */
export const FIRST_PRODUCTION = "2027";

const firstList: ProductionList = { productions: [FIRST_PRODUCTION] };

export function inMemoryProductionListStore(productions?: string[]): ProductionListStore {
  const list = productions ? ProductionList.parse({ productions }) : firstList;
  return { list: async () => list };
}

export const PRODUCTIONS_FILE = "productions.json";

/** Local file: `<dataDir>/productions.json` (git-ignored). */
export function fileProductionListStore(dataDir: string): ProductionListStore {
  const file = join(dataDir, PRODUCTIONS_FILE);
  const inTurn = oneAtATime();

  return {
    list: () =>
      inTurn(async () => {
        const text = await ifExists(() => readFile(file, "utf8"));
        if (text !== undefined) return ProductionList.parse(parseJson(text));
        await writePrivateFile(file, JSON.stringify(firstList, null, 2));
        return firstList;
      }),
  };
}
