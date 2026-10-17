import { afterEach, beforeEach, describe } from "vitest";
import { aTestTable, seedCast, seedRoles, type TestTable } from "./dynamo.fixture.ts";
import { dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoRemoveCastMember } from "./dynamo-remove-cast-member.ts";
import { dynamoRoleStore } from "./dynamo-role-store.ts";
import { behavesAsCastRemoval } from "./remove-cast-member.contract.ts";

describe("removing a cast member from the remote database", () => {
  let table: TestTable;
  beforeEach(async () => {
    table = await aTestTable();
  });
  afterEach(async () => {
    await table.drop();
  });

  behavesAsCastRemoval(async (castList, roleList) => {
    await seedCast(table.db, table.tableName, castList);
    await seedRoles(table.db, table.tableName, roleList);
    return {
      cast: dynamoCastStore(table.db, table.tableName),
      roles: dynamoRoleStore(table.db, table.tableName),
      remove: dynamoRemoveCastMember(table.db, table.tableName),
    };
  });
});
