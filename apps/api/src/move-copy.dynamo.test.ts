import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember, jo } from "./cast.fixture.ts";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoItemNoteStore } from "./dynamo-item-note-store.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
import { dynamoRunningOrderStore } from "./dynamo-running-order-store.ts";
import { copyProduction, readLocalProduction } from "./move-copy.ts";
import { aRole, hook } from "./role-store.contract.ts";
import { aRunningOrder } from "./running-order.fixture.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

// Made-up data only (CLAUDE.md safeguarding).
const cast = aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo", singing: "Alto" })]);
const roles = {
  productionId: "2027",
  roles: [aRole(3, { name: "Captain Hook", castMemberIds: [12] })],
};
const notes = { productionId: "2027", notes: [{ itemId: "finale", text: "Bows", revision: 2 }] };

describe("copying a production to the remote database", () => {
  let table: TestTable;
  let dataDir: string;
  beforeEach(async () => {
    table = await aTestTable();
    dataDir = await mkdtemp(join(tmpdir(), "move-copy-"));
    const folder = join(dataDir, "2027");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "cast.json"), JSON.stringify({ ...cast, nextId: 20 }));
    await writeFile(join(folder, "roles.json"), JSON.stringify(roles));
    await writeFile(join(folder, "item-notes.json"), JSON.stringify(notes));
    const versions = fileRunningOrderStore(dataDir);
    for (const version of [1, 2, 3, 4, 5, 6]) await versions.save(aRunningOrder(version));
  });
  afterEach(async () => {
    await table.drop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const copy = async () =>
    copyProduction(table.db, table.tableName, await readLocalProduction(dataDir, "2027"));
  const remote = () => ({
    cast: dynamoCastStore(table.db, table.tableName),
    roles: dynamoRoleStore(table.db, table.tableName),
    notes: dynamoItemNoteStore(table.db, table.tableName),
    runningOrders: dynamoRunningOrderStore(table.db, table.tableName),
  });

  /** Every local file's name and a hash of its contents. */
  async function fingerprint(folder = join(dataDir, "2027")): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true, recursive: true });
    const files = entries.filter((entry) => entry.isFile());
    return Promise.all(
      files.map(async (file) => {
        const path = join(file.parentPath, file.name);
        return `${path} ${createHash("sha256")
          .update(await readFile(path))
          .digest("hex")}`;
      }),
    );
  }

  it("copies everything exactly, so the app reads the same data from the remote database", async () => {
    expect((await copy()).outcome).toBe("copied");

    const { cast: castStore, roles: roleStore, notes: noteStore, runningOrders } = remote();
    expect(await castStore.list("2027")).toEqual(cast);
    expect(await roleStore.list("2027")).toEqual(roles);
    expect(await noteStore.list("2027")).toEqual(notes);
    for (const version of [1, 2, 3, 4, 5, 6]) {
      expect(await runningOrders.get("2027", version)).toEqual(aRunningOrder(version));
    }
    expect((await runningOrders.latest("2027"))?.version).toBe(6);
  });

  it("carries on handing out ids where the files would have", async () => {
    await copy();
    const { cast: castStore, roles: roleStore } = remote();

    expect((await castStore.add("2027", { ...jo }))?.id).toBe(20);
    expect(await roleStore.add("2027", "pirate-sketch", { ...hook, name: "Smee" })).toMatchObject({
      id: 4,
    });
  });

  it("keeps the copied role's name reserved in its item", async () => {
    await copy();

    // The copied role 3 is Captain Hook in Pirate Sketch.
    expect(await remote().roles.add("2027", "pirate-sketch", hook)).toBe("name-taken");
  });

  it("changes nothing when run again, and says everything was already there", async () => {
    await copy();

    const again = await copy();

    expect(again.outcome).toBe("copied");
    expect(Object.values(again.counts).every((count) => count.copied === 0)).toBe(true);
    expect((await remote().cast.list("2027"))?.members).toHaveLength(2);
  });

  it("writes nothing if the remote database holds a member differently", async () => {
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: "PROD#2027", sk: "CAST#00000012", ...aCastMember(12, { revision: 5 }) },
      }),
    );

    const report = await copy();

    expect(report).toMatchObject({ outcome: "refused", differing: ["cast: 12"] });
    expect(await remote().roles.list("2027")).toEqual({ productionId: "2027", roles: [] });
    expect(await remote().runningOrders.latest("2027")).toBeUndefined();
  });

  it("leaves the local files exactly as they were", async () => {
    const before = await fingerprint();

    await copy();

    expect(await fingerprint()).toEqual(before);
  });
});
