import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aTestTable, seedRoles, type TestTable } from "#/storage/dynamo.fixture.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
import { aRole, behavesAsARoleStore, hook } from "./role-store.contract.ts";

describe("DynamoDB role store", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsARoleStore(async (initial = []) => {
    for (const list of initial) await seedRoles(table.db, table.tableName, list);
    return dynamoRoleStore(table.db, table.tableName);
  });

  it("lets only one of two simultaneous renames to the same name through", async () => {
    await seedRoles(table.db, table.tableName, {
      productionId: "2027",
      roles: [aRole(1, { name: "Smee" }), aRole(2, { name: "Starkey" })],
    });
    const store = dynamoRoleStore(table.db, table.tableName);

    const results = await Promise.all([
      store.update("2027", 1, 1, hook),
      store.update("2027", 2, 1, hook),
    ]);

    expect(results.filter((result) => result === "name-taken")).toHaveLength(1);
    const names = (await store.list("2027")).roles.map((role) => role.name);
    expect(names.filter((name) => name === "Captain Hook")).toHaveLength(1);
  });

  it("never echoes a bad stored role's contents in its error", async () => {
    await seedRoles(table.db, table.tableName, {
      productionId: "2027",
      roles: [aRole(1, { name: "Sam Example", castMemberIds: [-1] })],
    });

    const error = await dynamoRoleStore(table.db, table.tableName)
      .list("2027")
      .catch((e: unknown) => e);

    expect(String(error)).toMatch(/roles for production 2027 are invalid/i);
    expect(String(error)).not.toContain("Sam Example");
  });

  it("refuses a production id that isn't valid", async () => {
    await expect(dynamoRoleStore(table.db, table.tableName).list("../etc")).rejects.toThrow();
  });
});
