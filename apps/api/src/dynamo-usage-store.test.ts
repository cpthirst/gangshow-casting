import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { documentClient } from "./dynamo-table.ts";
import { dynamoUsageStore, purgeRetiredPageUses } from "./dynamo-usage-store.ts";

// A fake client, not a database: no test of the purge needs a real one. The store's other
// rules are covered against DynamoDB Local in dynamo-usage-store.dynamo.test.ts.
const dynamo = mockClient(DynamoDBDocumentClient);
const db = () => documentClient(new DynamoDBClient({ region: "eu-west-2" }));
const TABLE = "GangshowData";

// Rows as the app stored them before Stage and Tech replaced Production's four pages.
const pageUse = (page: string, sk: string) => ({
  pk: "USAGE",
  sk,
  username: "robin",
  event: "page",
  page,
  at: "2026-10-20T19:00:00.000Z",
});
const viewUse = (view: string, sk: string) => ({
  pk: "USAGE",
  sk,
  username: "robin",
  event: "view",
  view,
  at: "2026-10-20T19:00:00.000Z",
});
const deletedKeys = () => dynamo.commandCalls(DeleteCommand).map((call) => call.args[0].input.Key);

beforeEach(() => dynamo.reset());

describe("the retired Production pages' usage", () => {
  it("is left out of what the Usage page reads, so it opens before the purge", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [pageUse("props", "1#a"), pageUse("cast", "2#b")] });

    const records = await dynamoUsageStore(db(), TABLE).since("2026-10-01T00:00:00.000Z");

    expect(records).toEqual([
      { username: "robin", event: "page", page: "cast", at: "2026-10-20T19:00:00.000Z" },
    ]);
  });

  it("is purged, every page of it, leaving every other use and the start date", async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({
        Items: [pageUse("mic-plot", "1#a"), pageUse("cast", "1#b"), pageUse("props", "1#c")],
        LastEvaluatedKey: { pk: "USAGE", sk: "1#c" },
      })
      .resolvesOnce({
        Items: [
          pageUse("scenery", "2#a"),
          viewUse("props", "2#b"),
          pageUse("sfx", "2#c"),
          { pk: "USAGE", sk: "SINCE", at: "2026-10-01T09:00:00.000Z" },
        ],
      });

    const purged = await purgeRetiredPageUses(db(), TABLE);

    expect(purged).toBe(4);
    expect(deletedKeys()).toEqual([
      { pk: "USAGE", sk: "1#a" },
      { pk: "USAGE", sk: "1#c" },
      { pk: "USAGE", sk: "2#a" },
      { pk: "USAGE", sk: "2#c" },
    ]);
    expect(dynamo.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({
      pk: "USAGE",
      sk: "1#c",
    });
  });

  it("can be purged again, removing nothing once it has gone", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [pageUse("cast", "1#a")] });

    expect(await purgeRetiredPageUses(db(), TABLE)).toBe(0);
    expect(deletedKeys()).toEqual([]);
  });

  it("reads only the usage partition, from the table it's given", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    await purgeRetiredPageUses(db(), TABLE);

    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "USAGE" },
    });
  });
});
