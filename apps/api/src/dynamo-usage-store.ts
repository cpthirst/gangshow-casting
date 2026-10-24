import { randomUUID } from "node:crypto";
import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { written } from "./dynamo-table.ts";
import type { UsageRecord, UsageStore } from "./usage-store.ts";

// Usage has one partition of its own (ADR 0023): it isn't any production's, and about 30
// accounts stay far below a partition's limits.
const USAGE = "USAGE";
// When recording started (FR11): no personal data, so it never expires.
const SINCE = "SINCE";
const RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * Usage in the production data table: one row per event, sorted by time, each removed by
 * the table's time-to-live 90 days on (usage-tracking FR9).
 */
export function dynamoUsageStore(db: DynamoDBDocumentClient, tableName: string): UsageStore {
  return {
    async record(entry) {
      // Only the first write of the marker wins, so the start date never moves.
      await written(() =>
        db.send(
          new PutCommand({
            TableName: tableName,
            Item: { pk: USAGE, sk: SINCE, at: entry.at },
            ConditionExpression: "attribute_not_exists(sk)",
          }),
        ),
      );
      await db.send(
        new PutCommand({
          TableName: tableName,
          // The random part keeps two events at the same moment apart. Keys last, so
          // nothing in the entry can stand in for them.
          Item: {
            ...entry,
            expiresAt: Math.floor(Date.parse(entry.at) / 1000) + RETENTION_SECONDS,
            pk: USAGE,
            sk: `${entry.at}#${randomUUID()}`,
          },
        }),
      );
    },

    async since(from) {
      const records: UsageRecord[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await db.send(
          new QueryCommand({
            TableName: tableName,
            // Every event's key starts with its time, a digit; the SINCE marker sorts after.
            KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
            ExpressionAttributeValues: { ":pk": USAGE, ":from": from, ":to": "9" },
            ConsistentRead: true,
            ExclusiveStartKey: startKey,
          }),
        );
        records.push(...(page.Items ?? []).map(asRecord));
        startKey = page.LastEvaluatedKey;
      } while (startKey);
      return records;
    },

    async recordedSince() {
      const { Item } = await db.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: USAGE, sk: SINCE },
          ConsistentRead: true,
        }),
      );
      return typeof Item?.at === "string" ? Item.at : undefined;
    },
  };
}

/** A stored row as a record, without its keys and expiry. */
function asRecord(row: Record<string, unknown>): UsageRecord {
  const { username, at } = row;
  if (typeof username !== "string" || typeof at !== "string" || row.event !== "session") {
    throw new Error(`Usage row ${String(row.sk)} is invalid`);
  }
  return { username, event: "session", at };
}
