import { ProductionId } from "@app/shared";
import { ConditionalCheckFailedException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// The production data table (ADR 0015): partition key "pk" and sort key "sk", matching
// infra/lib/app-stack.ts. Each production is one partition; each entity is one item.

export const documentClient = (client: DynamoDBClient) => DynamoDBDocumentClient.from(client);

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
