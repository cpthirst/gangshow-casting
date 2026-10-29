import { CastList, CastMember, ItemNoteList, Role, RoleList, RunningOrder } from "@app/shared";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAddRole } from "#/casting/roles/add-role.ts";
import { createGetRoles } from "#/casting/roles/get-roles.ts";
import { aRole } from "#/casting/roles/role-store.contract.ts";
import { createGetItemNotes } from "#/item-notes/get-item-notes.ts";
import { createSaveItemNote } from "#/item-notes/save-item-note.ts";
import { createAddCastMember } from "#/show/cast/add-cast-member.ts";
import { aCastList, aCastMember, jo } from "#/show/cast/cast.fixture.ts";
import { createDeleteCastMember } from "#/show/cast/delete-cast-member.ts";
import { createGetCast } from "#/show/cast/get-cast.ts";
import { createUpdateCastMember } from "#/show/cast/update-cast-member.ts";
import { createGetRunningOrder } from "#/show/running-order/get-running-order.ts";
import { anItem, aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { createSaveRunningOrder } from "#/show/running-order/save-running-order.ts";
import { dataStores } from "./data-stores.ts";
import { aTestTable, seedCast, seedRoles, type TestTable } from "./dynamo.fixture.ts";

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
    const { cast, roles, removeCastMember, props } = dataStores({
      ...process.env,
      DATA_TABLE: table.tableName,
    });

    const res = await createDeleteCastMember(
      removeCastMember,
      roles,
      props,
    )({
      pathParameters: { productionId: "2027", castId: "12" },
      queryStringParameters: { revision: "1" },
    });

    expect(res.statusCode).toBe(204);
    expect((await cast.list("2027"))?.members.map((m) => m.id)).toEqual([1]);
    expect((await roles.list("2027")).roles[0]?.castMemberIds).toEqual([1]);
  });

  it("saves running order versions through the API in the remote table, refusing old ones", async () => {
    const { runningOrders, roles, itemNotes } = dataStores({
      ...process.env,
      DATA_TABLE: table.tableName,
    });
    await runningOrders.save(aRunningOrder(4, { first: ["Curtain Up", "Finale"] }));
    const save = createSaveRunningOrder(runningOrders, {
      roles,
      itemNotes,
      sceneryFiles: { keepOnlyItems: async () => {} },
    });
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
