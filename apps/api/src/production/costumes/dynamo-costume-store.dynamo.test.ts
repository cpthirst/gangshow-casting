import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
import { aCostume, behavesAsACostumeStore } from "./costume-store.contract.ts";
import { costumeRow, dynamoCostumeStore } from "./dynamo-costume-store.ts";

describe("DynamoDB costume store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  const put = (Item: Record<string, unknown>) =>
    table.db.send(new PutCommand({ TableName: table.tableName, Item }));

  behavesAsACostumeStore(async (saved) => {
    for (const { productionId, costumes } of saved) {
      for (const costume of costumes) await put(costumeRow(productionId, costume));
    }
    return dynamoCostumeStore(table.db, table.tableName);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoCostumeStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });

  it("refuses a stored costume that isn't valid", async () => {
    await put(costumeRow("2027", aCostume("finale", 7, 1, { fromWardrobe: "x".repeat(501) })));

    await expect(dynamoCostumeStore(table.db, table.tableName).list("2027")).rejects.toThrow(
      "invalid",
    );
  });
});
