import { createHash } from "node:crypto";
import { normalisedRoleName, Role, RoleList } from "@app/shared";
import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  atRevision,
  META,
  partitionFor,
  queryAll,
  transacted,
  withoutKeys,
  written,
} from "./dynamo-table.ts";
import type { RoleRefusal, RoleStore } from "./role-store.ts";

const ROLE = "ROLE#";
/** A role's sort key. Zero-padded, so roles come back in id order. */
export const roleKey = (id: number) => `${ROLE}${String(id).padStart(8, "0")}`;

/** The sort key of the row that reserves a role's name in its item. Names match as
 *  sameRoleName says. Hashed, so any valid item id and name make a short, safe key. */
export const roleNameKey = ({ itemId, name }: Pick<Role, "itemId" | "name">) =>
  `ROLENAME#${createHash("sha256")
    .update(JSON.stringify([itemId, normalisedRoleName(name)]))
    .digest("hex")}`;

/** A role as stored: its row, keyed in its production. */
export const roleRow = (productionId: string, role: Role) => ({
  pk: partitionFor(productionId),
  sk: roleKey(role.id),
  ...role,
});

/** The role with a cast member taken out, as its next revision. */
export const withoutMember = (role: Role, castMemberId: number): Role => ({
  ...role,
  castMemberIds: role.castMemberIds.filter((id) => id !== castMemberId),
  revision: role.revision + 1,
});

/** A transaction holds at most 100 writes: a role and its name row each. */
const MOST_ROLES_PER_TRANSACTION = 50;

/** How many times uncasting re-reads roles that changed under it before giving up: plenty
 *  for a handful of volunteers editing at once. */
const UNCAST_PASSES = 5;

/**
 * Roles in the production data table (ADR 0015): one row per role, plus one row per name
 * reserving it in its item, written in the same transaction as the role, so two roles can
 * never share a name, even when saved at once. The META row's `lastRoleId` hands out ids,
 * so they're never reused. Anything that writes role rows directly (seeding, the copy) must
 * also write their name rows and set `lastRoleId` to the highest id.
 */
export function dynamoRoleStore(db: DynamoDBDocumentClient, tableName: string): RoleStore {
  const nameRow = (productionId: string, role: Role) => ({
    pk: partitionFor(productionId),
    sk: roleNameKey(role),
    roleId: role.id,
  });

  async function list(productionId: string) {
    const rows = await queryAll(db, tableName, productionId, ROLE);
    // Roles link children to parts, so a bad row becomes a fixed message with no cause.
    const parsed = RoleList.safeParse({ productionId, roles: rows.map(withoutKeys) });
    if (!parsed.success) throw new Error(`Roles for production ${productionId} are invalid`);
    return parsed.data;
  }

  async function current(productionId: string, id: number) {
    const row = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: roleKey(id) },
        ConsistentRead: true,
      }),
    );
    if (!row.Item) return undefined;
    const parsed = Role.safeParse(withoutKeys(row.Item));
    if (!parsed.success) throw new Error(`Role ${id} in production ${productionId} is invalid`);
    return parsed.data;
  }

  // A write at a revision failed: tell a stale revision from a role that isn't there.
  const refusal = async (productionId: string, id: number): Promise<"stale" | "not-found"> =>
    (await current(productionId, id)) ? "stale" : "not-found";

  /** Takes the production's next role id. One taken for an add that then fails is simply
   *  skipped: ids only need never to repeat. */
  async function takeNextId(productionId: string) {
    const result = await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: META },
        UpdateExpression: "ADD lastRoleId :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const id: unknown = result.Attributes?.lastRoleId;
    if (typeof id !== "number") throw new Error("The role id counter is missing");
    return id;
  }

  return {
    list,

    async add(productionId, itemId, details) {
      const role = Role.parse({
        ...details,
        id: await takeNextId(productionId),
        itemId,
        revision: 1,
      });
      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: roleRow(productionId, role),
                  ConditionExpression: "attribute_not_exists(sk)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: nameRow(productionId, role),
                  ConditionExpression: "attribute_not_exists(sk)",
                },
              },
            ],
          }),
        ),
      );
      if (!failed) return role;
      if (failed.includes(1)) return "name-taken";
      throw new Error("A new role's id was already in use");
    },

    async update(productionId, id, revision, details): Promise<Role | RoleRefusal> {
      // Read outside the transaction, but safely: its revision check fails if this changed.
      const old = await current(productionId, id);
      if (!old) return "not-found";
      const role = Role.parse({ ...old, ...details, revision: revision + 1 });
      const renamed = roleNameKey(old) !== roleNameKey(role);
      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: roleRow(productionId, role),
                  ...atRevision(revision),
                },
              },
              // A new name moves its reservation: the old one is freed, the new one must be free.
              ...(renamed
                ? [
                    {
                      Delete: {
                        TableName: tableName,
                        Key: { pk: partitionFor(productionId), sk: roleNameKey(old) },
                      },
                    },
                    {
                      Put: {
                        TableName: tableName,
                        Item: nameRow(productionId, role),
                        ConditionExpression: "attribute_not_exists(sk)",
                      },
                    },
                  ]
                : []),
            ],
          }),
        ),
      );
      if (!failed) return role;
      if (failed.includes(0)) return refusal(productionId, id);
      // Only the revision check (0) and the new name's reservation can fail their conditions.
      return "name-taken";
    },

    async remove(productionId, id, revision) {
      const old = await current(productionId, id);
      if (!old) return "not-found";
      // Deleted outright with its name, with no copy or history kept (ADR 0010). Only the
      // table's 7-day point-in-time recovery holds it until then.
      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: roleKey(id) },
                  ...atRevision(revision),
                },
              },
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: roleNameKey(old) },
                },
              },
            ],
          }),
        ),
      );
      return failed ? refusal(productionId, id) : "removed";
    },

    async uncastMember(productionId, castMemberId) {
      // Each role is saved at the revision it was read at; one that changed meanwhile is
      // read again on the next pass, so nobody's later casting is overwritten.
      for (let pass = 0; pass < UNCAST_PASSES; pass++) {
        const casting = (await list(productionId)).roles.filter((role) =>
          role.castMemberIds.includes(castMemberId),
        );
        if (casting.length === 0) return;
        for (const role of casting) {
          await written(() =>
            db.send(
              new PutCommand({
                TableName: tableName,
                Item: roleRow(productionId, withoutMember(role, castMemberId)),
                ...atRevision(role.revision),
              }),
            ),
          );
        }
      }
      throw new Error("Couldn't uncast a cast member: their roles kept changing");
    },

    async keepOnlyItems(productionId, itemIds) {
      const dropped = (await list(productionId)).roles.filter(
        (role) => !itemIds.includes(role.itemId),
      );
      // Each role goes with its name's reservation, so the name is free if the item returns.
      // The ids stay used: the counter only counts up. Not conditional on the revision, as
      // the item is gone whatever else changed.
      for (let from = 0; from < dropped.length; from += MOST_ROLES_PER_TRANSACTION) {
        const batch = dropped.slice(from, from + MOST_ROLES_PER_TRANSACTION);
        await db.send(
          new TransactWriteCommand({
            TransactItems: batch.flatMap((role) => [
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: roleKey(role.id) },
                },
              },
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: roleNameKey(role) },
                },
              },
            ]),
          }),
        );
      }
    },
  };
}
