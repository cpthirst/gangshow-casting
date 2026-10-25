import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type AddPropRequest, ProductionId, Prop, PropList } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";
import { oneAtATime, writePrivateFile } from "./private-file.ts";

/** Where each production's props live (stage-props FR13): the production's own, apart from
 *  its casting. Editing and removing come with the stories that need them. */
export interface PropStore {
  /** Every item's props; none until the first is added. */
  list(productionId: string): Promise<PropList>;
  /** Adds a prop to an item, with the next unused id. */
  add(productionId: string, itemId: string, details: AddPropRequest): Promise<Prop>;
}

// The stored file also remembers the next id, so a removed prop's id is never reused.
const PropFile = PropList.extend({ nextId: Prop.shape.id.optional() });
type PropFile = ReturnType<typeof PropFile.parse>;

const emptyFile = (productionId: string): PropFile => ({ productionId, props: [] });

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: PropFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.props.map((prop) => prop.id)) + 1);

const listOf = ({ productionId, props }: PropFile): PropList => ({ productionId, props });

/** The file with a new prop added to the item under the next id. */
function withNewProp(file: PropFile, itemId: string, details: AddPropRequest) {
  const prop: Prop = { ...details, id: nextIdOf(file), itemId };
  return { prop, file: { ...file, props: [...file.props, prop], nextId: prop.id + 1 } };
}

/** Props held in memory, starting with those given: for tests. */
export function inMemoryPropStore(saved: PropList[] = []): PropStore {
  const files = new Map<string, PropFile>(saved.map((list) => [list.productionId, list]));
  const fileOf = (productionId: string) => files.get(productionId) ?? emptyFile(productionId);
  return {
    list: async (productionId) => listOf(fileOf(productionId)),
    async add(productionId, itemId, details) {
      const added = withNewProp(fileOf(productionId), itemId, details);
      files.set(productionId, added.file);
      return added.prop;
    },
  };
}

/** Local file: `<dataDir>/<productionId>/props.json` (git-ignored), created with the first
 *  prop. */
export function filePropStore(dataDir: string): PropStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "props.json");
  };

  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    if (text === undefined) return emptyFile(productionId);
    const parsed = PropFile.safeParse(parseJson(text));
    if (!parsed.success || parsed.data.productionId !== productionId) {
      throw new Error(`Props file for production ${productionId} is invalid`);
    }
    return parsed.data;
  }

  const write = (file: PropFile) =>
    writePrivateFile(fileFor(file.productionId), JSON.stringify(PropFile.parse(file), null, 2));
  const inTurn = oneAtATime();

  return {
    list: async (productionId) => listOf(await read(productionId)),
    add: (productionId, itemId, details) =>
      // Read and saved in one turn, so two adds at once can't take the same id.
      inTurn(async () => {
        const added = withNewProp(await read(productionId), itemId, details);
        await write(added.file);
        return added.prop;
      }),
  };
}
