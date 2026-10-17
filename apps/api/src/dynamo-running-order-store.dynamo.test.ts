import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { dynamoRunningOrderStore } from "./dynamo-running-order-store.ts";
import { behavesAsARunningOrderStore } from "./running-order-store.contract.ts";

describe("DynamoDB running order store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsARunningOrderStore(async (initial = []) => {
    const store = dynamoRunningOrderStore(table.db, table.tableName);
    for (const order of initial) await store.save(order);
    return store;
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(
      dynamoRunningOrderStore(table.db, table.tableName).latest("../etc"),
    ).rejects.toThrow();
  });
});
