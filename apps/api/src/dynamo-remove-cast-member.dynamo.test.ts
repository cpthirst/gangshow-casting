import { type DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { aTestTable, seedCast, seedRoles, type TestTable } from "./dynamo.fixture.ts";
import { dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoRemoveCastMember } from "./dynamo-remove-cast-member.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
import { behavesAsCastRemoval } from "./remove-cast-member.contract.ts";
import { aRole } from "./role-store.contract.ts";

describe("removing a cast member from the remote database", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  const stores = () => ({
    cast: dynamoCastStore(table.db, table.tableName),
    roles: dynamoRoleStore(table.db, table.tableName),
  });

  behavesAsCastRemoval(async (castList, roleList) => {
    await seedCast(table.db, table.tableName, castList);
    await seedRoles(table.db, table.tableName, roleList);
    return { ...stores(), remove: dynamoRemoveCastMember(table.db, table.tableName) };
  });

  /** The table's client, but `meanwhile` runs once, just before the first transaction is
   *  sent: someone else's change landing mid-delete. */
  function racing(meanwhile: () => Promise<unknown>): DynamoDBDocumentClient {
    let raced = false;
    return new Proxy(table.db, {
      get(target, property, receiver) {
        if (property !== "send") return Reflect.get(target, property, receiver);
        return async (command: unknown) => {
          if (command instanceof TransactWriteCommand && !raced) {
            raced = true;
            await meanwhile();
          }
          return Reflect.apply(target.send, target, [command]);
        };
      },
    });
  }

  // Jo (12) is in role 1 with Sam (1).
  const seed = async (roleCount = 1) => {
    await seedCast(table.db, table.tableName, aCastList([aCastMember(1), aCastMember(12)]));
    await seedRoles(table.db, table.tableName, {
      productionId: "2027",
      roles: Array.from({ length: roleCount }, (_, i) =>
        aRole(i + 1, { itemId: `item-${i % 30}`, castMemberIds: [12, 1] }),
      ),
    });
  };
  const castIn = async () =>
    (await stores().roles.list("2027")).roles.flatMap((role) => role.castMemberIds);

  it("also clears a role they were cast in while the delete was under way", async () => {
    await seed();
    const { roles } = stores();
    const lateRole = { name: "Late Addition", size: "lead" as const, castMemberIds: [12] };
    const db = racing(() => roles.add("2027", "campfire-song", lateRole));

    expect(await dynamoRemoveCastMember(db, table.tableName)("2027", 12, 1)).toBe("removed");

    expect(await castIn()).toEqual([1]);
    expect((await roles.list("2027")).roles).toHaveLength(2);
  });

  it("starts again when one of their roles changes mid-delete, keeping that change", async () => {
    await seed();
    const { roles } = stores();
    const recast = { name: "Role 1", size: "ensemble" as const, castMemberIds: [12, 1, 13] };
    const db = racing(() => roles.update("2027", 1, 1, recast));

    expect(await dynamoRemoveCastMember(db, table.tableName)("2027", 12, 1)).toBe("removed");

    expect(await castIn()).toEqual([1, 13]);
    expect((await stores().cast.list("2027"))?.members.map((m) => m.id)).toEqual([1]);
  });

  it.each([99, 100])("fully uncasts someone in %i roles", async (roleCount) => {
    await seed(roleCount);

    expect(await dynamoRemoveCastMember(table.db, table.tableName)("2027", 12, 1)).toBe("removed");

    expect(new Set(await castIn())).toEqual(new Set([1]));
  });
});
