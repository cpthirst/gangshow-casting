import { RunningOrder } from "@app/shared";
import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { partitionFor, withoutKeys, written } from "#/storage/dynamo-table.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

const VERSION = "RO#";
/** A version's sort key. Zero-padded (8 digits is ample for versions saved by hand), so
 *  versions sort by number and the newest is last. */
const versionKey = (version: number) => `${VERSION}${String(version).padStart(8, "0")}`;

/** A stored version. The items' free text can name children, so a bad row becomes a fixed
 *  message naming only the production and version. */
function parse(row: Record<string, unknown> | undefined) {
  if (row === undefined) return undefined;
  const parsed = RunningOrder.safeParse(withoutKeys(row));
  if (!parsed.success) {
    throw new Error(`Running order ${String(row.sk)} for ${String(row.pk)} is invalid`);
  }
  return parsed.data;
}

/**
 * Running order versions in the production data table (ADR 0015): one row per version, a
 * complete snapshot that's never edited. A version is saved only if it doesn't exist yet,
 * so two saves of the same version can't both win, and every earlier one is kept.
 */
export function dynamoRunningOrderStore(
  db: DynamoDBDocumentClient,
  tableName: string,
): RunningOrderStore {
  return {
    async latest(productionId) {
      const newest = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :version)",
          ExpressionAttributeValues: { ":pk": partitionFor(productionId), ":version": VERSION },
          ScanIndexForward: false,
          Limit: 1,
          ConsistentRead: true,
        }),
      );
      return parse(newest.Items?.[0]);
    },

    async get(productionId, version) {
      const row = await db.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: partitionFor(productionId), sk: versionKey(version) },
          ConsistentRead: true,
        }),
      );
      return parse(row.Item);
    },

    async save(order) {
      const saved = await written(() =>
        db.send(
          new PutCommand({
            TableName: tableName,
            // Keys last, so nothing in the order can stand in for them.
            Item: { ...order, pk: partitionFor(order.productionId), sk: versionKey(order.version) },
            ConditionExpression: "attribute_not_exists(sk)",
          }),
        ),
      );
      return saved ? "saved" : "conflict";
    },
  };
}
