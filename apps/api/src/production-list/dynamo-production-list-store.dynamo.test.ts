import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
import { dynamoProductionListStore } from "./dynamo-production-list-store.ts";
import { behavesAsAProductionListStore } from "./production-list-store.contract.ts";

describe("DynamoDB production list store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsAProductionListStore(async (productions = []) => {
    for (const sk of productions) {
      await table.db.send(
        new PutCommand({ TableName: table.tableName, Item: { pk: "PRODUCTIONS", sk } }),
      );
    }
    return dynamoProductionListStore(table.db, table.tableName);
  });

  it("writes 2027 as a row of its own the first time the list is read", async () => {
    await dynamoProductionListStore(table.db, table.tableName).list();

    const { Items } = await table.db.send(
      new QueryCommand({
        TableName: table.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "PRODUCTIONS" },
      }),
    );
    expect(Items).toEqual([{ pk: "PRODUCTIONS", sk: "2027" }]);
  });
});
