import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
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

  it("never echoes a bad stored version's contents (which could name children) in its error", async () => {
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: "PROD#2027", sk: "RO#00000001", version: 1, leads: "Zed Gone" },
      }),
    );

    const error = await dynamoRunningOrderStore(table.db, table.tableName)
      .latest("2027")
      .catch((e: unknown) => e);

    expect(String(error)).toMatch(/running order RO#00000001 for PROD#2027 is invalid/i);
    expect(String(error)).not.toMatch(/Zed|Gone/);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(
      dynamoRunningOrderStore(table.db, table.tableName).latest("../etc"),
    ).rejects.toThrow();
  });
});
