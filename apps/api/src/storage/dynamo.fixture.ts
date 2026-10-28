import { randomUUID } from "node:crypto";
import type { CastList, RoleList } from "@app/shared";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { roleKey, roleNameKey } from "#/casting/roles/dynamo-role-store.ts";
import { castKey } from "#/show/cast/dynamo-cast-store.ts";
import { documentClient, META, partitionFor } from "./dynamo-table.ts";

// Database tests talk only to a local emulator (ADR 0016), never to AWS, so they refuse to
// run unless the DynamoDB endpoint is on this machine.
function requireLocalEmulator() {
  const endpoint = process.env.AWS_ENDPOINT_URL_DYNAMODB ?? "";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(endpoint)) {
    throw new Error(`Database tests need a local DynamoDB emulator, not "${endpoint}"`);
  }
}

/** A fresh, empty table shaped like the real one (infra/lib/app-stack.ts), on the emulator. */
export async function aTestTable() {
  requireLocalEmulator();
  const client = new DynamoDBClient({});
  const tableName = `test-${randomUUID()}`;
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
    }),
  );
  return {
    client,
    db: documentClient(client),
    tableName,
    drop: () => client.send(new DeleteTableCommand({ TableName: tableName })),
  };
}

export type TestTable = Awaited<ReturnType<typeof aTestTable>>;

/** Writes a cast list straight into a table, with the next id past every member's. */
export async function seedCast(db: DynamoDBDocumentClient, tableName: string, list: CastList) {
  const pk = partitionFor(list.productionId);
  const castNextId = Math.max(0, ...list.members.map((m) => m.id)) + 1;
  // Updated, not replaced: META also holds other counters.
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk, sk: META },
      UpdateExpression: "SET castNextId = :next",
      ExpressionAttributeValues: { ":next": castNextId },
    }),
  );
  for (const member of list.members) {
    await db.send(
      new PutCommand({ TableName: tableName, Item: { pk, sk: castKey(member.id), ...member } }),
    );
  }
}

/** Writes roles straight into a table, with their name rows and the last id given out. */
export async function seedRoles(db: DynamoDBDocumentClient, tableName: string, list: RoleList) {
  const pk = partitionFor(list.productionId);
  const lastRoleId = Math.max(0, ...list.roles.map((role) => role.id));
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk, sk: META },
      UpdateExpression: "SET lastRoleId = :last",
      ExpressionAttributeValues: { ":last": lastRoleId },
    }),
  );
  for (const role of list.roles) {
    await db.send(
      new PutCommand({ TableName: tableName, Item: { pk, sk: roleKey(role.id), ...role } }),
    );
    await db.send(
      new PutCommand({
        TableName: tableName,
        Item: { pk, sk: roleNameKey(role), roleId: role.id },
      }),
    );
  }
}
