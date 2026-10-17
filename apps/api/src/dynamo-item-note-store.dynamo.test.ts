import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { dynamoItemNoteStore } from "./dynamo-item-note-store.ts";
import { documentClient } from "./dynamo-table.ts";
import { behavesAsAnItemNoteStore } from "./item-note-store.contract.ts";

describe("DynamoDB item note store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsAnItemNoteStore(() => dynamoItemNoteStore(table.db, table.tableName));

  it("reads notes saved through another connection", async () => {
    await dynamoItemNoteStore(table.db, table.tableName).save("2027", "finale", 0, "Bows");

    // A second client on the same table, as another API process would have.
    const again = dynamoItemNoteStore(documentClient(new DynamoDBClient({})), table.tableName);
    expect((await again.list("2027")).notes).toEqual([
      { itemId: "finale", text: "Bows", revision: 1 },
    ]);
  });

  it("keeps each production's notes apart", async () => {
    const store = dynamoItemNoteStore(table.db, table.tableName);
    await store.save("2027", "finale", 0, "Bows");

    expect((await store.list("2028")).notes).toEqual([]);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoItemNoteStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });
});
