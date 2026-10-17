import { CastList, ItemNoteList } from "@app/shared";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { dataStores } from "./data-stores.ts";
import { aTestTable, seedCast, type TestTable } from "./dynamo.fixture.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveItemNote } from "./save-item-note.ts";

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
