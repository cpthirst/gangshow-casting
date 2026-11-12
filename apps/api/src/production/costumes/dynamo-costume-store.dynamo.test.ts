import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dynamoRoleStore } from "#/casting/roles/dynamo-role-store.ts";
import { dynamoCastStore } from "#/show/cast/dynamo-cast-store.ts";
import { aTestTable, seedCast, seedRoles, type TestTable } from "#/storage/dynamo.fixture.ts";
import { aCostume, behavesAsACostumeStore, costumeCasting } from "./costume-store.contract.ts";
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

  const seedCasting = async () => {
    await seedRoles(table.db, table.tableName, costumeCasting.roles);
    await seedCast(table.db, table.tableName, costumeCasting.cast);
  };

  behavesAsACostumeStore(async (saved) => {
    await seedCasting();
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

  describe("racing a casting change", () => {
    // Made-up: Alex Morgan (1) as Captain Hook (7), the role as the save read it.
    const alexAsHook = aCostume("opening-number", 7, 1);
    const hook = costumeCasting.roles.roles[0];
    const store = () => dynamoCostumeStore(table.db, table.tableName);

    it("refuses as stale a save once its role has changed, saving nothing", async () => {
      await seedCasting();
      if (!hook) throw new Error("expected Captain Hook");
      await dynamoRoleStore(table.db, table.tableName).update("2027", hook.id, hook.revision, {
        name: hook.name,
        size: hook.size,
        castMemberIds: [2],
      });

      expect(await store().save("2027", alexAsHook, 0, hook)).toBe("stale");
      expect((await store().list("2027")).costumes).toEqual([]);
    });

    it("refuses as stale a save once the cast member is deleted, saving nothing", async () => {
      await seedCasting();
      if (!hook) throw new Error("expected Captain Hook");
      await dynamoCastStore(table.db, table.tableName).remove("2027", 1, 1);

      expect(await store().save("2027", alexAsHook, 0, hook)).toBe("stale");
      expect((await store().list("2027")).costumes).toEqual([]);
    });
  });
});
