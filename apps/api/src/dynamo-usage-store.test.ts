import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { documentClient } from "./dynamo-table.ts";
import { dynamoUsageStore } from "./dynamo-usage-store.ts";

// A fake client, not a database: leaving gone pages out needs no real one. The store's other
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

beforeEach(() => dynamo.reset());

describe("the Stage, Tech and Wardrobe pages' usage, from before the Overview", () => {
  it("is left out of what the Usage page reads, with their views and Costume's, so it still opens", async () => {
    dynamo.on(QueryCommand).resolves({
      Items: [
        pageUse("stage", "1#a"),
        pageUse("tech", "1#b"),
        pageUse("wardrobe", "1#c"),
        pageUse("costume", "1#d"),
        ...["scenery", "props", "mic-plot", "sfx"].map((view, i) => viewUse(view, `2#${i}`)),
        viewUse("grid", "3#a"),
        pageUse("production-overview", "3#b"),
      ],
    });

    const records = await dynamoUsageStore(db(), TABLE).since("2026-10-01T00:00:00.000Z");

    expect(records).toEqual([
      { username: "robin", event: "view", view: "grid", at: "2026-10-20T19:00:00.000Z" },
      {
        username: "robin",
        event: "page",
        page: "production-overview",
        at: "2026-10-20T19:00:00.000Z",
      },
    ]);
  });
});

describe("the retired Production pages' usage", () => {
  it("is left out of what the Usage page reads, so it still opens", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [pageUse("props", "1#a"), pageUse("cast", "2#b")] });

    const records = await dynamoUsageStore(db(), TABLE).since("2026-10-01T00:00:00.000Z");

    expect(records).toEqual([
      { username: "robin", event: "page", page: "cast", at: "2026-10-20T19:00:00.000Z" },
    ]);
  });
});
