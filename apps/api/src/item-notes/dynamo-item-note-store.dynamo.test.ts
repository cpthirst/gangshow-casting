import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, type TestTable } from "#/storage/dynamo.fixture.ts";
import { documentClient } from "#/storage/dynamo-table.ts";
import { dynamoItemNoteStore, PROPS_NOTE, SCENERY_NOTE } from "./dynamo-item-note-store.ts";
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

  describe("for props notes", () => {
    behavesAsAnItemNoteStore(() => dynamoItemNoteStore(table.db, table.tableName, PROPS_NOTE));

    it("keeps props notes apart from the casting notes", async () => {
      const casting = dynamoItemNoteStore(table.db, table.tableName);
      const props = dynamoItemNoteStore(table.db, table.tableName, PROPS_NOTE);
      await casting.save("2027", "pirate-sketch", 0, "Sword fight");

      await props.save("2027", "pirate-sketch", 0, "Chest");

      expect((await casting.list("2027")).notes.map((note) => note.text)).toEqual(["Sword fight"]);
      expect((await props.list("2027")).notes.map((note) => note.text)).toEqual(["Chest"]);
    });
  });

  describe("for scenery notes", () => {
    behavesAsAnItemNoteStore(() => dynamoItemNoteStore(table.db, table.tableName, SCENERY_NOTE));

    it("keeps scenery notes apart from the props notes", async () => {
      const props = dynamoItemNoteStore(table.db, table.tableName, PROPS_NOTE);
      const scenery = dynamoItemNoteStore(table.db, table.tableName, SCENERY_NOTE);
      await props.save("2027", "pirate-sketch", 0, "Chest");

      await scenery.save("2027", "pirate-sketch", 0, "Cloud");

      expect((await props.list("2027")).notes.map((note) => note.text)).toEqual(["Chest"]);
      expect((await scenery.list("2027")).notes.map((note) => note.text)).toEqual(["Cloud"]);
    });
  });

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

  it("refuses an item id that isn't valid, saving nothing", async () => {
    const store = dynamoItemNoteStore(table.db, table.tableName);

    await expect(store.save("2027", "x".repeat(41), 0, "Bows")).rejects.toThrow();
    expect((await store.list("2027")).notes).toEqual([]);
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoItemNoteStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });
});
