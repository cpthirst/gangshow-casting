import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { documentsInFiles, documentsInMemory, saveRevised } from "./production-documents.ts";

interface Tally {
  productionId: string;
  count: number;
}

const isTally = (data: unknown): data is Tally =>
  typeof data === "object" &&
  data !== null &&
  "productionId" in data &&
  typeof data.productionId === "string" &&
  "count" in data &&
  typeof data.count === "number";

// As one of the shared zod schemas reads a file, without needing one.
const Tally = {
  safeParse: (data: unknown) =>
    isTally(data) ? { success: true as const, data } : { success: false as const },
  parse(data: unknown) {
    if (!isTally(data)) throw new Error("Not a tally");
    return data;
  },
};

const empty = (productionId: string): Tally => ({ productionId, count: 0 });

describe("documents in files", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "documents-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const documents = () =>
    documentsInFiles({ dataDir, fileName: "tally.json", label: "Tally", schema: Tally, empty });
  const putFile = async (contents: string) => {
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(join(dataDir, "2027", "tally.json"), contents);
  };
  const add = (tally: Tally) => ({
    answer: tally.count + 1,
    save: { ...tally, count: tally.count + 1 },
  });

  it("reads what stands for a document until one is saved", async () => {
    expect(await documents().read("2027")).toEqual({ productionId: "2027", count: 0 });
  });

  it("saves owner-only, for the next read", async () => {
    const tallies = documents();

    expect(await tallies.change("2027", add)).toBe(1);

    expect(await tallies.read("2027")).toEqual({ productionId: "2027", count: 1 });
    const { mode } = await stat(join(dataDir, "2027", "tally.json"));
    expect(mode & 0o777).toBe(0o600);
  });

  it("makes no file when there's nothing to save", async () => {
    const tallies = documents();

    await saveRevised(tallies, "2027", () => undefined);

    expect(await readdir(dataDir)).toEqual([]);
  });

  it("runs changes one at a time, so neither overwrites the other", async () => {
    const tallies = documents();

    expect(await Promise.all([tallies.change("2027", add), tallies.change("2027", add)])).toEqual([
      1, 2,
    ]);
    expect(await tallies.read("2027")).toEqual({ productionId: "2027", count: 2 });
  });

  it("refuses an id that couldn't name a production, before touching a file", async () => {
    await expect(documents().read("../elsewhere")).rejects.toThrow("Invalid production id");
  });

  it("reports an unreadable file in one fixed message, quoting nothing from it", async () => {
    await putFile('{"productionId":"2027","count":"Alex Morgan"}');

    const failure = await documents()
      .read("2027")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", "Tally file for production 2027 is invalid");
    expect(failure).not.toHaveProperty("cause");
  });

  it("refuses a file that belongs to another production", async () => {
    await putFile('{"productionId":"2026","count":1}');

    await expect(documents().read("2027")).rejects.toThrow("is invalid");
  });
});

describe("documents in memory", () => {
  it("starts with those given, and keeps each production's apart", async () => {
    const tallies = documentsInMemory<Tally>([{ productionId: "2026", count: 5 }], empty);

    await tallies.change("2027", (tally) => ({ answer: 0, save: { ...tally, count: 1 } }));

    expect(await tallies.read("2026")).toEqual({ productionId: "2026", count: 5 });
    expect(await tallies.read("2027")).toEqual({ productionId: "2027", count: 1 });
  });
});
