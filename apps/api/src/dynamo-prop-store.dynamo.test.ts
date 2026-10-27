import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { dynamoPropStore, propRow } from "./dynamo-prop-store.ts";
import { META, partitionFor } from "./dynamo-table.ts";
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
      // As anything writing prop rows directly must: the counter past the highest id.
      await table.db.send(
        new UpdateCommand({
          TableName: table.tableName,
          Key: { pk: partitionFor(productionId), sk: META },
          UpdateExpression: "SET lastPropId = :last",
          ExpressionAttributeValues: { ":last": Math.max(0, ...props.map((prop) => prop.id)) },
        }),
      );
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

  it("gives a prop saved before props had quantities a quantity of 1", async () => {
    const chest = { id: 1, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] };
    const { quantity: _, ...oldRow } = propRow("2027", { ...chest, quantity: 1 });
    await table.db.send(new PutCommand({ TableName: table.tableName, Item: oldRow }));

    expect((await dynamoPropStore(table.db, table.tableName).list("2027")).props).toEqual([
      { ...chest, quantity: 1 },
    ]);
  });

  it("refuses a stored prop that isn't valid", async () => {
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: {
          ...propRow("2027", {
            id: 1,
            itemId: "finale",
            name: "Confetti",
            quantity: 1,
            roleIds: [],
          }),
          name: "",
        },
      }),
    );

    await expect(dynamoPropStore(table.db, table.tableName).list("2027")).rejects.toThrow(
      "invalid",
    );
  });
});
