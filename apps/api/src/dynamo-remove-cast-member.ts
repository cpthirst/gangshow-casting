import type { Role } from "@app/shared";
import { type DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { castKey, dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoRoleStore, roleRow } from "./dynamo-role-store.ts";
import { partitionFor, transacted } from "./dynamo-table.ts";
import { type RemoveCastMember, uncastThenRemove } from "./remove-cast-member.ts";

/** A transaction holds at most 100 writes: the member's delete and 99 roles. */
const MOST_ROLES_IN_ONE_CHANGE = 99;
/** How many times to start again when one of the member's roles changes mid-delete. */
const ATTEMPTS = 5;

/**
 * Deletes a cast member and saves every role they're in without them, in one transaction:
 * all of it happens, or none (ADR 0015). Each role is saved at the revision it was read at,
 * so a role changed meanwhile cancels the lot, and it starts again. Someone in more roles
 * than one transaction holds falls back to roles first, then the member, then a sweep.
 */
export function dynamoRemoveCastMember(
  db: DynamoDBDocumentClient,
  tableName: string,
): RemoveCastMember {
  const cast = dynamoCastStore(db, tableName);
  const roles = dynamoRoleStore(db, tableName);
  const fallback = uncastThenRemove(cast, roles);

  return async (productionId, id, revision) => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const casting = (await roles.list(productionId)).roles.filter((role) =>
        role.castMemberIds.includes(id),
      );
      if (casting.length > MOST_ROLES_IN_ONE_CHANGE) return fallback(productionId, id, revision);

      const uncast = (role: Role): Role => ({
        ...role,
        castMemberIds: role.castMemberIds.filter((member) => member !== id),
        revision: role.revision + 1,
      });
      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: castKey(id) },
                  ConditionExpression: "revision = :revision",
                  ExpressionAttributeValues: { ":revision": revision },
                },
              },
              ...casting.map((role) => ({
                Put: {
                  TableName: tableName,
                  Item: roleRow(productionId, uncast(role)),
                  ConditionExpression: "revision = :revision",
                  ExpressionAttributeValues: { ":revision": role.revision },
                },
              })),
            ],
          }),
        ),
      );
      if (!failed) return "removed";
      if (failed.includes(0)) {
        const member = (await cast.list(productionId))?.members.find((m) => m.id === id);
        return member ? "stale" : "not-found";
      }
      // One of their roles changed since it was read: read them again and retry.
    }
    throw new Error("Couldn't delete a cast member: their roles kept changing");
  };
}
