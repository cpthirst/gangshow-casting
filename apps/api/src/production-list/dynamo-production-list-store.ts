import { setTimeout as wait } from "node:timers/promises";
import {
  BatchWriteCommand,
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { partitionFor, written } from "#/storage/dynamo-table.ts";
import {
  assertIsYear,
  FIRST_PRODUCTION,
  type ProductionListStore,
  productionListOf,
} from "./production-list-store.ts";

const PRODUCTIONS = "PRODUCTIONS";
/** The most rows DynamoDB deletes in one request. */
const DELETE_BATCH = 25;
/** How many times a batch is sent before the delete fails and can be repeated (ADR 0037). */
const BATCH_ATTEMPTS = 4;
const RETRY_MS = 50;

type DeleteRequest = { DeleteRequest: { Key: Record<string, unknown> } };

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
      if (Items.length > 0) {
        const years = (marked: boolean) =>
          Items.filter((row) => (row.deleting === true) === marked).map((row) => row.sk);
        return productionListOf(years(false), years(true));
      }
      // Simultaneous first reads write the same row, and only if absent, so none can undo a
      // mark made since.
      await written(() =>
        db.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: PRODUCTIONS, sk: FIRST_PRODUCTION },
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        ),
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

    async markDeleting(year) {
      await written(() =>
        db.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: PRODUCTIONS, sk: year },
            UpdateExpression: "SET deleting = :yes",
            ExpressionAttributeValues: { ":yes": true },
            ConditionExpression: "attribute_exists(pk)",
          }),
        ),
      );
    },

    // Everything in the partition, so a new kind of data goes without a change here. Each page
    // is deleted as it's read, and the keys alone are read, never the children's names.
    async eraseData(year) {
      assertIsYear(year);
      const pk = partitionFor(year);
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await db.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": pk },
            ProjectionExpression: "pk, sk",
            ConsistentRead: true,
            ExclusiveStartKey: startKey,
          }),
        );
        const rows: DeleteRequest[] = (page.Items ?? []).map((Key) => ({
          DeleteRequest: { Key },
        }));
        for (let at = 0; at < rows.length; at += DELETE_BATCH) {
          await sendAll(rows.slice(at, at + DELETE_BATCH));
        }
        startKey = page.LastEvaluatedKey;
      } while (startKey);
    },

    async remove(year) {
      await db.send(
        new DeleteCommand({ TableName: tableName, Key: { pk: PRODUCTIONS, sk: year } }),
      );
    },
  };

  /** Sends a batch, then what a busy table left of it. Only how many in the error: keys can
   *  say something about the show. */
  async function sendAll(batch: DeleteRequest[]) {
    let waiting = batch;
    for (let attempt = 0; attempt < BATCH_ATTEMPTS && waiting.length > 0; attempt += 1) {
      if (attempt > 0) await wait(RETRY_MS * 2 ** attempt);
      const { UnprocessedItems } = await db.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: waiting } }),
      );
      waiting = (UnprocessedItems?.[tableName] ?? []).flatMap(({ DeleteRequest }) =>
        DeleteRequest?.Key ? [{ DeleteRequest: { Key: DeleteRequest.Key } }] : [],
      );
    }
    if (waiting.length > 0) throw new Error(`${waiting.length} rows weren't deleted`);
  }
}
