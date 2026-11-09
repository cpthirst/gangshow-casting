import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { dynamoProductionListStore } from "./dynamo-production-list-store.ts";

// What the calls to the table must be, which the emulator's tests (ADR 0016) can't force:
// a race at just the wrong moment, and a table too busy to take a whole batch.
const TABLE = "made-up-table";
const db = mockClient(DynamoDBDocumentClient);
const store = () =>
  dynamoProductionListStore(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE);
const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ pk: "PROD#2027", sk: `CAST#${i}` }));
const batches = () =>
  db.commandCalls(BatchWriteCommand).map((call) => call.args[0].input.RequestItems?.[TABLE]);

describe("the list of productions in the table", () => {
  beforeEach(() => db.reset());

  it("writes 2027 on the first read only if it's still absent, so it can't undo a mark", async () => {
    db.on(QueryCommand).resolves({ Items: [] });
    db.on(PutCommand).resolves({});

    await store().list();

    expect(db.commandCalls(PutCommand)[0]?.args[0].input).toMatchObject({
      Item: { pk: "PRODUCTIONS", sk: "2027" },
      ConditionExpression: "attribute_not_exists(pk)",
    });
  });

  it("still lists 2027 when another first read wrote it first", async () => {
    db.on(QueryCommand).resolves({ Items: [] });
    db.on(PutCommand).rejects(
      new ConditionalCheckFailedException({ message: "exists", $metadata: {} }),
    );

    expect(await store().list()).toEqual({ productions: ["2027"] });
  });
});

describe("erasing a production's partition", () => {
  beforeEach(() => db.reset());

  it("reads only the keys of that one partition, consistently, and never Scans", async () => {
    db.on(QueryCommand).resolves({ Items: rows(1) });
    db.on(BatchWriteCommand).resolves({});

    await store().eraseData("2027");

    expect(db.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "PROD#2027" },
      ProjectionExpression: "pk, sk",
      ConsistentRead: true,
    });
    expect(db.commandCalls(ScanCommand)).toEqual([]);
  });

  it("deletes in batches of 25, across every page of the partition", async () => {
    db.on(QueryCommand)
      .resolvesOnce({ Items: rows(30), LastEvaluatedKey: { pk: "PROD#2027", sk: "CAST#29" } })
      .resolvesOnce({ Items: rows(1) });
    db.on(BatchWriteCommand).resolves({});

    await store().eraseData("2027");

    expect(batches().map((batch) => batch?.length)).toEqual([25, 5, 1]);
    expect(batches()[1]?.[0]).toEqual({
      DeleteRequest: { Key: { pk: "PROD#2027", sk: "CAST#25" } },
    });
  });

  it("sends again what a busy table left unprocessed", async () => {
    const left = { DeleteRequest: { Key: { pk: "PROD#2027", sk: "CAST#0" } } };
    db.on(QueryCommand).resolves({ Items: rows(2) });
    db.on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [TABLE]: [left] } })
      .resolvesOnce({});

    await store().eraseData("2027");

    expect(batches()).toHaveLength(2);
    expect(batches()[1]).toEqual([left]);
  });

  it("fails, so the delete can be repeated, when the table keeps leaving rows", async () => {
    const left = { DeleteRequest: { Key: { pk: "PROD#2027", sk: "CAST#0" } } };
    db.on(QueryCommand).resolves({ Items: rows(1) });
    db.on(BatchWriteCommand).resolves({ UnprocessedItems: { [TABLE]: [left] } });

    await expect(store().eraseData("2027")).rejects.toThrow("1 rows weren't deleted");
  });

  it.each(["../2027", "files"])("refuses %j, which isn't a year, reading nothing", async (id) => {
    await expect(store().eraseData(id)).rejects.toThrow("Invalid production id");

    expect(db.commandCalls(QueryCommand)).toEqual([]);
  });
});
