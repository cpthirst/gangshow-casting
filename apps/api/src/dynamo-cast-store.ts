import { CastList, CastMember } from "@app/shared";
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CastStore } from "./cast-store.ts";
import { conditionFailed, META, partitionFor, queryAll, withoutKeys } from "./dynamo-table.ts";

const CAST = "CAST#";
/** A member's sort key. Zero-padded, so members come back in id order. */
export const castKey = (id: number) => `${CAST}${String(id).padStart(8, "0")}`;

/**
 * The cast list in the production data table (ADR 0015): one row per member. The
 * production's META row holds `castNextId`, which marks that it has a cast list and hands
 * out ids atomically, so they're never reused, even across API processes.
 */
export function dynamoCastStore(db: DynamoDBDocumentClient, tableName: string): CastStore {
  const keyOf = (productionId: string, id: number) => ({
    pk: partitionFor(productionId),
    sk: castKey(id),
  });

  const hasCastList = async (productionId: string) => {
    const meta = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: META },
        ConsistentRead: true,
      }),
    );
    return meta.Item?.castNextId !== undefined;
  };

  // A conditional write failed: tell a stale revision from a member who isn't there.
  const refusal = async (productionId: string, id: number) => {
    const row = await db.send(
      new GetCommand({ TableName: tableName, Key: keyOf(productionId, id), ConsistentRead: true }),
    );
    return row.Item ? "stale" : "not-found";
  };

  // Write a member only if they're still at `revision`.
  const atRevision = (revision: number) => ({
    ConditionExpression: "revision = :revision",
    ExpressionAttributeValues: { ":revision": revision },
  });

  return {
    async list(productionId) {
      if (!(await hasCastList(productionId))) return undefined;
      const rows = await queryAll(db, tableName, productionId, CAST);
      return CastList.parse({ productionId, members: rows.map(withoutKeys) });
    },

    async add(productionId, details) {
      let id: unknown;
      try {
        const counter = await db.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: partitionFor(productionId), sk: META },
            UpdateExpression: "SET castNextId = castNextId + :one",
            ConditionExpression: "attribute_exists(castNextId)",
            ExpressionAttributeValues: { ":one": 1 },
            ReturnValues: "UPDATED_OLD",
          }),
        );
        id = counter.Attributes?.castNextId;
      } catch (error) {
        if (conditionFailed(error)) return undefined;
        throw error;
      }
      const member = CastMember.parse({ ...details, id, revision: 1 });
      // Never overwrites: the counter starts past every id in use (see seeding and copying).
      await db.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...keyOf(productionId, member.id), ...member },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      return member;
    },

    async update(productionId, id, revision, details) {
      const member = CastMember.parse({ ...details, id, revision: revision + 1 });
      try {
        await db.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...keyOf(productionId, id), ...member },
            ...atRevision(revision),
          }),
        );
      } catch (error) {
        if (conditionFailed(error)) return refusal(productionId, id);
        throw error;
      }
      return member;
    },

    async remove(productionId, id, revision) {
      try {
        // The row is deleted outright: no copy or history is kept (ADR 0010).
        await db.send(
          new DeleteCommand({
            TableName: tableName,
            Key: keyOf(productionId, id),
            ...atRevision(revision),
          }),
        );
      } catch (error) {
        if (conditionFailed(error)) return refusal(productionId, id);
        throw error;
      }
      return "removed";
    },
  };
}
