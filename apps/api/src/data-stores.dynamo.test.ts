import { CastList, CastMember, ItemNoteList, Role, RoleList } from "@app/shared";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAddCastMember } from "./add-cast-member.ts";
import { createAddRole } from "./add-role.ts";
import { aCastList, aCastMember, jo } from "./cast.fixture.ts";
import { dataStores } from "./data-stores.ts";
import { aTestTable, seedCast, type TestTable } from "./dynamo.fixture.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { createGetRoles } from "./get-roles.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveItemNote } from "./save-item-note.ts";
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
