import { type DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { castKey, dynamoCastStore } from "./dynamo-cast-store.ts";
import { dynamoRoleStore, roleRow, withoutMember } from "./dynamo-role-store.ts";
import { atRevision, partitionFor, transacted } from "./dynamo-table.ts";
import { type RemoveCastMember, uncastThenRemove } from "./remove-cast-member.ts";

/** A transaction holds at most 100 writes: the member's delete and 99 roles. */
const MOST_ROLES_IN_ONE_CHANGE = 99;
/** The member's delete comes first in the transaction; their roles follow. */
const MEMBER_DELETE = 0;
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
      // Every role is read, as there's no index by member: a few hundred at most.
      const casting = (await roles.list(productionId)).roles.filter((role) =>
        role.castMemberIds.includes(id),
      );
      if (casting.length > MOST_ROLES_IN_ONE_CHANGE) return fallback(productionId, id, revision);

      const failed = await transacted(() =>
        db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: tableName,
                  Key: { pk: partitionFor(productionId), sk: castKey(id) },
                  ...atRevision(revision),
                },
              },
              ...casting.map((role) => ({
                Put: {
                  TableName: tableName,
                  Item: roleRow(productionId, withoutMember(role, id)),
                  ...atRevision(role.revision),
                },
              })),
            ],
          }),
        ),
      );
      if (!failed) {
        // A role they were cast in after the roles were read isn't in the transaction, so
        // sweep once more: no trace is left (ADR 0010). It writes nothing if there's none.
        await roles.uncastMember(productionId, id);
        return "removed";
      }
      if (failed.includes(MEMBER_DELETE)) {
        const member = (await cast.list(productionId))?.members.find((m) => m.id === id);
        return member ? "stale" : "not-found";
      }
      // One of their roles changed since it was read: read them again and retry.
    }
    throw new Error("Couldn't delete a cast member: their roles kept changing");
  };
}
