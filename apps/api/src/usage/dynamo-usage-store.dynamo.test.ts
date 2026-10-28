import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
import { dynamoUsageStore } from "./dynamo-usage-store.ts";
import { behavesAsAUsageStore } from "./usage-store.contract.ts";

describe("DynamoDB usage store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsAUsageStore(() => dynamoUsageStore(table.db, table.tableName));

  it("gives each record an expiry 90 days on, for the table to remove it then", async () => {
    await dynamoUsageStore(table.db, table.tableName).record({
      username: "robin",
      event: "session",
      at: "2026-10-24T09:00:00.000Z",
    });

    const { Items = [] } = await table.db.send(
      new QueryCommand({
        TableName: table.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :day)",
        ExpressionAttributeValues: { ":pk": "USAGE", ":day": "2026-10-24" },
      }),
    );
    expect(Items).toHaveLength(1);
    expect(Items[0]?.expiresAt).toBe(Date.parse("2027-01-22T09:00:00.000Z") / 1000);
  });

  it("keeps when recording started in a row that never expires", async () => {
    await dynamoUsageStore(table.db, table.tableName).record({
      username: "robin",
      event: "session",
      at: "2026-10-24T09:00:00.000Z",
    });

    const { Item } = await table.db.send(
      new GetCommand({ TableName: table.tableName, Key: { pk: "USAGE", sk: "SINCE" } }),
    );
    expect(Item).toEqual({ pk: "USAGE", sk: "SINCE", at: "2026-10-24T09:00:00.000Z" });
  });
});
