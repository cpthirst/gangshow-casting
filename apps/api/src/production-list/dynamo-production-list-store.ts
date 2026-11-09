import { ProductionList } from "@app/shared";
import { type DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { written } from "#/storage/dynamo-table.ts";
import { FIRST_PRODUCTION, type ProductionListStore } from "./production-list-store.ts";

const PRODUCTIONS = "PRODUCTIONS";

/** The list in the data table (ADR 0036): a partition of its own, one row per production. */
export function dynamoProductionListStore(
  db: DynamoDBDocumentClient,
  tableName: string,
): ProductionListStore {
  return {
    async list() {
      const { Items = [] } = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": PRODUCTIONS },
          ConsistentRead: true,
        }),
      );
      if (Items.length > 0)
        return ProductionList.parse({ productions: Items.map((row) => row.sk) });
      // Simultaneous first reads just write the same row.
      await db.send(
        new PutCommand({ TableName: tableName, Item: { pk: PRODUCTIONS, sk: FIRST_PRODUCTION } }),
      );
      return { productions: [FIRST_PRODUCTION] };
    },

    async start(year) {
      const started = await written(() =>
        db.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: PRODUCTIONS, sk: year },
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        ),
      );
      return started ? "started" : "exists";
    },
  };
}
