import { CastList, CastMember } from "@app/shared";
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CastStore, Refusal } from "./cast-store.ts";
import { META, partitionFor, queryAll, withoutKeys, written } from "./dynamo-table.ts";

const CAST = "CAST#";
/** A member's sort key. Zero-padded, so members come back in id order. */
export const castKey = (id: number) => `${CAST}${String(id).padStart(8, "0")}`;

/**
 * The cast list in the production data table (ADR 0015): one row per member. The
 * production's META row holds `castNextId`, which marks that it has a cast list and hands
 * out ids atomically, so they're never reused, even across API processes. Anything that
 * writes member rows directly (seeding, the copy) must set `castNextId` past every id.
 */
export function dynamoCastStore(db: DynamoDBDocumentClient, tableName: string): CastStore {
  const keyOf = (productionId: string, id: number) => ({
    pk: partitionFor(productionId),
    sk: castKey(id),
  });

  // A conditional write failed: tell a stale revision from a member who isn't there.
  async function refusal(productionId: string, id: number): Promise<Refusal> {
    const row = await db.send(
      new GetCommand({ TableName: tableName, Key: keyOf(productionId, id), ConsistentRead: true }),
    );
    return row.Item ? "stale" : "not-found";
  }

  // Write a member only if they're still at `revision`.
  const atRevision = (revision: number) => ({
    ConditionExpression: "revision = :revision",
    ExpressionAttributeValues: { ":revision": revision },
  });

  async function hasCastList(productionId: string) {
    const meta = await db.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: partitionFor(productionId), sk: META },
        ConsistentRead: true,
      }),
    );
    return meta.Item?.castNextId !== undefined;
  }

  /** Takes the production's next cast id, or undefined if it has no cast list. An id taken
   *  for an add that then fails is simply skipped: ids only need never to repeat. */
  async function takeNextId(productionId: string): Promise<number | undefined> {
    let taken: unknown;
    const counted = await written(async () => {
      const result = await db.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { pk: partitionFor(productionId), sk: META },
          UpdateExpression: "SET castNextId = castNextId + :one",
          ConditionExpression: "attribute_exists(castNextId)",
          ExpressionAttributeValues: { ":one": 1 },
          ReturnValues: "UPDATED_OLD",
        }),
      );
      taken = result.Attributes?.castNextId;
    });
    return counted && typeof taken === "number" ? taken : undefined;
  }

  return {
    async list(productionId) {
      if (!(await hasCastList(productionId))) return undefined;
      const rows = await queryAll(db, tableName, productionId, CAST);
      // Rows hold children's names, so a bad one becomes a fixed message with no cause:
      // nothing from the data reaches a log (as with the file store).
      const parsed = CastList.safeParse({ productionId, members: rows.map(withoutKeys) });
      if (!parsed.success) throw new Error(`Cast list for production ${productionId} is invalid`);
      return parsed.data;
    },

    async add(productionId, details) {
      const id = await takeNextId(productionId);
      if (id === undefined) return undefined;
      const member = CastMember.parse({ ...details, id, revision: 1 });
      await db.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...keyOf(productionId, id), ...member },
          // Never overwrites: castNextId is always past every stored id.
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
      return member;
    },

    async update(productionId, id, revision, details) {
      const member = CastMember.parse({ ...details, id, revision: revision + 1 });
      const saved = await written(() =>
        db.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...keyOf(productionId, id), ...member },
            ...atRevision(revision),
          }),
        ),
      );
      return saved ? member : refusal(productionId, id);
    },

    async remove(productionId, id, revision) {
      // The row is deleted outright, with no copy or history kept (ADR 0010). Only the
      // table's 7-day point-in-time recovery holds it until then.
      const removed = await written(() =>
        db.send(
          new DeleteCommand({
            TableName: tableName,
            Key: keyOf(productionId, id),
            ...atRevision(revision),
          }),
        ),
      );
      return removed ? "removed" : refusal(productionId, id);
    },
  };
}
