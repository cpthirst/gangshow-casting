import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { dynamoPropStore, propRow } from "./dynamo-prop-store.ts";
import { behavesAsAPropStore } from "./prop-store.contract.ts";

describe("DynamoDB prop store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsAPropStore(async (saved) => {
    for (const { productionId, props } of saved) {
      for (const prop of props) {
        await table.db.send(
          new PutCommand({ TableName: table.tableName, Item: propRow(productionId, prop) }),
        );
      }
    }
    return dynamoPropStore(table.db, table.tableName);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoPropStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });

  it("refuses a stored prop that isn't valid", async () => {
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { ...propRow("2027", { id: 1, itemId: "finale", name: "Confetti" }), name: "" },
      }),
    );

    await expect(dynamoPropStore(table.db, table.tableName).list("2027")).rejects.toThrow(
      "invalid",
    );
  });
});
