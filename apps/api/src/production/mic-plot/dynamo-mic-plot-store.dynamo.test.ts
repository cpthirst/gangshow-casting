import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
import { dynamoMicPlotStore, micPlotRow } from "./dynamo-mic-plot-store.ts";
import { behavesAsAMicPlotStore } from "./mic-plot-store.contract.ts";

describe("DynamoDB mic plot store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  const put = (Item: Record<string, unknown>) =>
    table.db.send(new PutCommand({ TableName: table.tableName, Item }));

  behavesAsAMicPlotStore(async (saved) => {
    for (const { productionId, items } of saved) {
      for (const plot of items) await put(micPlotRow(productionId, plot));
    }
    return dynamoMicPlotStore(table.db, table.tableName);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoMicPlotStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });

  it("reads a mic saved with a role, which the mic plot doesn't keep, and drops it on the next save", async () => {
    // As an unreleased build of production-mics E1.S2 saved them.
    await put({
      ...micPlotRow("2027", { itemId: "finale", mics: [] }),
      mics: [{ channel: 3, castMemberId: 1, roleId: 7 }],
    });
    const store = dynamoMicPlotStore(table.db, table.tableName);

    expect((await store.list("2027")).items).toEqual([
      { itemId: "finale", mics: [{ channel: 3, castMemberId: 1 }] },
    ]);
    expect(await store.allocate("2027", "finale", 4, 2)).toEqual({
      itemId: "finale",
      mics: [
        { channel: 3, castMemberId: 1 },
        { channel: 4, castMemberId: 2 },
      ],
    });
  });

  it("refuses a stored mic plot that isn't valid", async () => {
    await put({
      ...micPlotRow("2027", { itemId: "finale", mics: [] }),
      mics: [{ channel: 25, castMemberId: 1 }],
    });

    await expect(dynamoMicPlotStore(table.db, table.tableName).list("2027")).rejects.toThrow(
      "invalid",
    );
  });

  it("puts no one on two channels when two mics are given to them at once", async () => {
    const store = dynamoMicPlotStore(table.db, table.tableName);

    const results = await Promise.all([
      store.allocate("2027", "finale", 3, 1),
      store.allocate("2027", "finale", 4, 1),
    ]);

    expect(results.filter((result) => "onAnotherChannel" in result)).toHaveLength(1);
    expect((await store.list("2027")).items[0]?.mics).toHaveLength(1);
  });
});
