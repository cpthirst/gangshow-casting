import { CastList, CastMember, ItemNoteList, Role, RoleList, RunningOrder } from "@app/shared";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAddCastMember } from "./add-cast-member.ts";
import { createAddRole } from "./add-role.ts";
import { aCastList, aCastMember, jo } from "./cast.fixture.ts";
import { dataStores } from "./data-stores.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";
import { aTestTable, seedCast, seedRoles, type TestTable } from "./dynamo.fixture.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { createGetRoles } from "./get-roles.ts";
import { createGetRunningOrder } from "./get-running-order.ts";
import { aRole } from "./role-store.contract.ts";
import { anItem, aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveItemNote } from "./save-item-note.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";

describe("data stores with a remote table", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  it("reads the cast list through the API from the remote table", async () => {
    const list = aCastList([aCastMember(1), aCastMember(2, { firstName: "Alex" })]);
    await seedCast(table.db, table.tableName, list);
    const { cast } = dataStores({ ...process.env, DATA_TABLE: table.tableName });

    const res = await createGetCast(cast)({ pathParameters: { productionId: "2027" } });

    expect(CastList.parse(JSON.parse(res.body ?? ""))).toEqual(list);
  });

  it("adds and edits cast members through the API in the remote table", async () => {
    await seedCast(table.db, table.tableName, aCastList([aCastMember(1)]));
    const { cast } = dataStores({ ...process.env, DATA_TABLE: table.tableName });

    const added = await createAddCastMember(cast)({
      pathParameters: { productionId: "2027" },
      body: JSON.stringify({ ...jo, singing: "Alto" }),
    });
    const edited = await createUpdateCastMember(cast)({
      pathParameters: { productionId: "2027", castId: "1" },
      body: JSON.stringify({ ...jo, firstName: "Sam", revision: 1 }),
    });
    const read = await createGetCast(cast)({ pathParameters: { productionId: "2027" } });

    expect([added.statusCode, edited.statusCode]).toEqual([201, 200]);
    expect(CastList.parse(JSON.parse(read.body ?? "")).members).toEqual([
      { ...jo, firstName: "Sam", id: 1, revision: 2 },
      CastMember.parse(JSON.parse(added.body ?? "")),
    ]);
  });

  it("adds and reads roles through the API in the remote table", async () => {
    await seedCast(table.db, table.tableName, aCastList([aCastMember(1)]));
    const { cast, roles } = dataStores({ ...process.env, DATA_TABLE: table.tableName });
    const finale = itemId("Finale");
    const runningOrders = inMemoryRunningOrderStore([aRunningOrder(1, { first: ["Finale"] })]);

    const added = await createAddRole(
      roles,
      runningOrders,
      cast,
    )({
      pathParameters: { productionId: "2027", itemId: finale },
      body: JSON.stringify({ name: "Captain Hook", size: "lead", castMemberIds: [1] }),
    });
    const read = await createGetRoles(roles)({ pathParameters: { productionId: "2027" } });

    expect(added.statusCode).toBe(201);
    expect(RoleList.parse(JSON.parse(read.body ?? "")).roles).toEqual([
      Role.parse(JSON.parse(added.body ?? "")),
    ]);
  });

  it("deletes a cast member through the API, taking them out of their roles", async () => {
    await seedCast(table.db, table.tableName, aCastList([aCastMember(1), aCastMember(12)]));
    await seedRoles(table.db, table.tableName, {
      productionId: "2027",
      roles: [aRole(1, { castMemberIds: [12, 1] })],
    });
    const { cast, roles, removeCastMember } = dataStores({
      ...process.env,
      DATA_TABLE: table.tableName,
    });

    const res = await createDeleteCastMember(removeCastMember)({
      pathParameters: { productionId: "2027", castId: "12" },
      queryStringParameters: { revision: "1" },
    });

    expect(res.statusCode).toBe(204);
    expect((await cast.list("2027"))?.members.map((m) => m.id)).toEqual([1]);
    expect((await roles.list("2027")).roles[0]?.castMemberIds).toEqual([1]);
  });

  it("saves running order versions through the API in the remote table, refusing old ones", async () => {
    const { runningOrders } = dataStores({ ...process.env, DATA_TABLE: table.tableName });
    await runningOrders.save(aRunningOrder(4, { first: ["Curtain Up", "Finale"] }));
    const save = createSaveRunningOrder(runningOrders);
    const saveFrom = (baseVersion: number, titles: string[]) =>
      save({
        pathParameters: { productionId: "2027" },
        body: JSON.stringify({
          baseVersion,
          change: {
            type: "update",
            halves: [
              { id: "first-half", items: titles.map(anItem) },
              { id: "second-half", items: [] },
            ],
          },
        }),
      });

    // Saves can reorder items, not add them.
    const saved = await saveFrom(4, ["Finale", "Curtain Up"]);
    const stale = await saveFrom(4, ["Curtain Up", "Finale"]);
    const read = await createGetRunningOrder(runningOrders)({
      pathParameters: { productionId: "2027" },
    });

    expect([saved.statusCode, stale.statusCode]).toEqual([201, 409]);
    const latest = RunningOrder.parse(JSON.parse(read.body ?? ""));
    expect(latest.version).toBe(5);
    expect(latest.halves[0].items.map((item) => item.title)).toEqual(["Finale", "Curtain Up"]);
  });

  it("saves and reads item notes through the API in the remote table", async () => {
    const { itemNotes } = dataStores({ ...process.env, DATA_TABLE: table.tableName });
    const finale = itemId("Finale");
    const runningOrders = inMemoryRunningOrderStore([aRunningOrder(1, { first: ["Finale"] })]);

    const saved = await createSaveItemNote(
      itemNotes,
      runningOrders,
    )({
      pathParameters: { productionId: "2027", itemId: finale },
      body: JSON.stringify({ text: "Bows", revision: 0 }),
    });
    const read = await createGetItemNotes(itemNotes)({ pathParameters: { productionId: "2027" } });

    expect(saved.statusCode).toBe(200);
    expect(ItemNoteList.parse(JSON.parse(read.body ?? "")).notes).toEqual([
      { itemId: finale, text: "Bows", revision: 1 },
    ]);
    const stored = await table.db.send(
      new GetCommand({
        TableName: table.tableName,
        Key: { pk: "PROD#2027", sk: `NOTE#${finale}` },
      }),
    );
    expect(stored.Item).toMatchObject({ text: "Bows", revision: 1 });
  });
});
