import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, seedCast, type TestTable } from "#/storage/dynamo.fixture.ts";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { behavesAsACastStore } from "./cast-store.contract.ts";
import { castKey, dynamoCastStore } from "./dynamo-cast-store.ts";

describe("DynamoDB cast store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsACastStore(async (initial = []) => {
    for (const list of initial) await seedCast(table.db, table.tableName, list);
    return dynamoCastStore(table.db, table.tableName);
  });

  it("lists members in id order, past single digits", async () => {
    const store = dynamoCastStore(table.db, table.tableName);
    await seedCast(table.db, table.tableName, { productionId: "2027", members: [] });

    for (let i = 0; i < 11; i++)
      await store.add("2027", { firstName: "Jo", lastName: "Newcomer", section: null, group: "" });

    expect((await store.list("2027"))?.members.map((m) => m.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("never echoes a bad stored row's contents (which could include names) in its error", async () => {
    await seedCast(table.db, table.tableName, aCastList([aCastMember(1)]));
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: "PROD#2027", sk: castKey(2), ...aCastMember(2), dateOfBirth: "Zed Gone" },
      }),
    );

    const error = await dynamoCastStore(table.db, table.tableName)
      .list("2027")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toMatch(/Zed|Gone|dateOfBirth/);
    expect(error instanceof Error && error.cause).toBeUndefined();
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoCastStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });
});
