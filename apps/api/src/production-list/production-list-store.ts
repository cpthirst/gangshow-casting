import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { ProductionList, ProductionYear } from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { filesFolderIn, ifExists } from "#/storage/files.ts";
import { oneAtATime, writePrivateFile } from "#/storage/private-file.ts";

/**
 * Which productions exist (ADR 0036). `list` is the only way to read them, because it also
 * puts in the production that was already held before there was a list: FIRST_PRODUCTION.
 */
export interface ProductionListStore {
  /** Every production, in no particular order; an empty list becomes FIRST_PRODUCTION. */
  list(): Promise<ProductionList>;
  /** Adds a production, unless it's already held. Never touches any other production. */
  start(year: string): Promise<"started" | "exists">;
  /** Moves a held production to `deleting` before any of it goes (ADR 0037). */
  markDeleting(year: string): Promise<void>;
  /** Deletes everything held under the production, whatever kind it is, except its files in
   *  the bucket and its row in the list. Safe to repeat. */
  eraseData(year: string): Promise<void>;
  /** Takes the production out of the list, last, once the rest has gone. */
  remove(year: string): Promise<void>;
}

/** A list from its parts, which fails rather than leave no production to open. */
export const productionListOf = (productions: string[], deleting: string[]) =>
  ProductionList.parse({ productions, ...(deleting.length > 0 ? { deleting } : {}) });

/** Erasing goes by what the id names, so only a year will do: a looser id such as "files"
 *  is a folder of something else. Never trust callers to have checked it. */
export function assertIsYear(year: string) {
  if (!ProductionYear.safeParse(year).success) throw new Error("Invalid production id");
}

const isHeld = ({ productions, deleting = [] }: ProductionList, year: string) =>
  productions.includes(year) || deleting.includes(year);

function withMarked(list: ProductionList, year: string) {
  if (!list.productions.includes(year)) return list;
  return productionListOf(
    list.productions.filter((held) => held !== year),
    [...(list.deleting ?? []), year],
  );
}

const without = ({ productions, deleting = [] }: ProductionList, year: string) =>
  productionListOf(
    productions.filter((held) => held !== year),
    deleting.filter((held) => held !== year),
  );

/** Written by the first read that finds the list empty. The newest production can't be
 *  deleted, so the list never empties again and a deleted 2027 stays deleted (ADR 0036). */
export const FIRST_PRODUCTION = "2027";

const firstList: ProductionList = { productions: [FIRST_PRODUCTION] };

export function inMemoryProductionListStore(productions?: string[]): ProductionListStore {
  let list = productions ? ProductionList.parse({ productions }) : firstList;
  return {
    list: async () => list,
    async start(year) {
      if (isHeld(list, year)) return "exists";
      list = productionListOf([...list.productions, year], list.deleting ?? []);
      return "started";
    },
    async markDeleting(year) {
      list = withMarked(list, year);
    },
    eraseData: async () => {},
    async remove(year) {
      list = without(list, year);
    },
  };
}

export const PRODUCTIONS_FILE = "productions.json";

/** Local file: `<dataDir>/productions.json` (git-ignored). */
export function fileProductionListStore(dataDir: string): ProductionListStore {
  const file = join(dataDir, PRODUCTIONS_FILE);
  const inTurn = oneAtATime();
  const write = (list: ProductionList) => writePrivateFile(file, JSON.stringify(list, null, 2));

  async function read() {
    const text = await ifExists(() => readFile(file, "utf8"));
    if (text !== undefined) return ProductionList.parse(parseJson(text));
    await write(firstList);
    return firstList;
  }

  return {
    list: () => inTurn(read),
    start: (year) =>
      inTurn(async () => {
        const list = await read();
        if (isHeld(list, year)) return "exists";
        await write({ ...list, productions: [...list.productions, year] });
        return "started";
      }),
    markDeleting: (year) => inTurn(async () => write(withMarked(await read(), year))),
    async eraseData(year) {
      assertIsYear(year);
      await rm(join(dataDir, year), { recursive: true, force: true });
      await rm(join(filesFolderIn(dataDir), year), { recursive: true, force: true });
    },
    remove: (year) => inTurn(async () => write(without(await read(), year))),
  };
}
