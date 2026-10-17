import { ProductionId } from "@app/shared";
import {
  ConditionalCheckFailedException,
  type DynamoDBClient,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// The production data table (ADR 0015): partition key "pk" and sort key "sk", matching
// infra/lib/app-stack.ts. Each production is one partition; each entity is one item.

// For every store: optional fields left out (like a member's notes) are simply not stored.
export const documentClient = (client: DynamoDBClient) =>
  DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

/** Each production's one row of counters and markers, such as the next cast id. */
export const META = "META";

/** A row without its table keys: the entity as stored. */
export const withoutKeys = ({ pk: _pk, sk: _sk, ...entity }: Record<string, unknown>) => entity;

/** A production's partition. The id is checked, as it is for the file stores' folders. */
export function partitionFor(productionId: string) {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  return `PROD#${productionId}`;
}

/** Every item in a production whose sort key starts with `prefix`, read consistently, so a
 *  read straight after a write sees it. */
export async function queryAll(
  db: DynamoDBDocumentClient,
  tableName: string,
  productionId: string,
  prefix: string,
) {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": partitionFor(productionId), ":prefix": prefix },
        ConsistentRead: true,
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

/** Whether a write was refused by its condition, e.g. a stale revision. */
export const conditionFailed = (error: unknown) => error instanceof ConditionalCheckFailedException;

/** Runs a conditional write: true if it was written, false if its condition failed. */
export async function written(write: () => Promise<unknown>) {
  try {
    await write();
    return true;
  } catch (error) {
    if (conditionFailed(error)) return false;
    throw error;
  }
}

/** Runs a transaction: undefined if it was written, or the positions of the writes whose
 *  conditions failed (so the caller can say why, e.g. a stale revision or a taken name). */
export async function transacted(write: () => Promise<unknown>): Promise<number[] | undefined> {
  try {
    await write();
    return undefined;
  } catch (error) {
    if (!(error instanceof TransactionCanceledException)) throw error;
    const failed = (error.CancellationReasons ?? []).flatMap((reason, i) =>
      reason.Code === "ConditionalCheckFailed" ? [i] : [],
    );
    // Cancelled for another reason, such as a clash with another transaction: not a refusal.
    if (failed.length === 0) throw error;
    return failed;
  }
}
