import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId } from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { ifExists } from "./files.ts";
import { oneAtATime, writePrivateFile } from "./private-file.ts";

/** What a change decides: the answer for whoever asked, and the document to save, if any. */
export interface Change<Stored, Answer> {
  answer: Answer;
  save?: Stored | undefined;
}

/**
 * Each production's one document of something, kept in a file or, for tests, in memory, so a
 * store's rules are written once. Held is what a read gives: the document, or whatever stands
 * for one not there yet.
 */
export interface ProductionDocuments<Stored, Held = Stored> {
  read(productionId: string): Promise<Held>;
  /** Reads, decides and saves in one turn, so two changes at once can't overwrite each other. */
  change<Answer>(
    productionId: string,
    decide: (document: Held) => Change<Stored, Answer>,
  ): Promise<Answer>;
}

/** Saves the document `revise` gives back; none means there's nothing to save. */
export const saveRevised = <Stored, Held>(
  documents: ProductionDocuments<Stored, Held>,
  productionId: string,
  revise: (document: Held) => Stored | undefined,
) => documents.change(productionId, (document) => ({ answer: undefined, save: revise(document) }));

/** Documents held in memory, starting with those given: for tests. */
export function documentsInMemory<Stored extends { productionId: string }, Empty = Stored>(
  saved: readonly Stored[],
  empty: (productionId: string) => Empty,
): ProductionDocuments<Stored, Stored | Empty> {
  const held = new Map(saved.map((document) => [document.productionId, document]));
  const current = (productionId: string) => held.get(productionId) ?? empty(productionId);
  return {
    read: async (productionId) => current(productionId),
    async change(productionId, decide) {
      const { answer, save } = decide(current(productionId));
      if (save) held.set(productionId, save);
      return answer;
    },
  };
}

/** Local files: `<dataDir>/<productionId>/<fileName>` (git-ignored), owner-only (ADR 0010). */
export function documentsInFiles<Stored extends { productionId: string }, Empty = Stored>({
  dataDir,
  fileName,
  label,
  schema,
  empty,
}: {
  dataDir: string;
  fileName: string;
  /** What the invalid-file error calls it: "Cast". */
  label: string;
  schema: {
    parse(data: unknown): Stored;
    safeParse(data: unknown): { success: true; data: Stored } | { success: false };
  };
  empty: (productionId: string) => Empty;
}): ProductionDocuments<Stored, Stored | Empty> {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, fileName);
  };

  // Parse errors can quote the file, and the files hold children's names, so any problem
  // becomes one fixed message with no cause attached: nothing from the file reaches a log.
  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    if (text === undefined) return empty(productionId);
    const parsed = schema.safeParse(parseJson(text));
    if (!parsed.success || parsed.data.productionId !== productionId) {
      throw new Error(`${label} file for production ${productionId} is invalid`);
    }
    return parsed.data;
  }

  const inTurn = oneAtATime();
  return {
    read,
    change: (productionId, decide) =>
      inTurn(async () => {
        const { answer, save } = decide(await read(productionId));
        if (save) {
          await writePrivateFile(
            fileFor(productionId),
            JSON.stringify(schema.parse(save), null, 2),
          );
        }
        return answer;
      }),
  };
}
