import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { s3SceneryFileStore } from "./s3-scenery-file-store.ts";

const BUCKET = "made-up-files";
const s3 = mockClient(S3Client);
const store = () => s3SceneryFileStore(new S3Client({ region: "eu-west-2" }), BUCKET);
const prefix = "2027/opening-number/scenery/";

beforeEach(() => s3.reset());

describe("scenery files in a bucket", () => {
  it("lists the item's own folder, and nothing nested inside it", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: `${prefix}set-plan.pdf`, Size: 2_400_000 }],
      CommonPrefixes: [{ Prefix: `${prefix}old/` }],
    });

    expect(await store().list("2027", "opening-number")).toEqual([
      { name: "set-plan.pdf", size: 2_400_000 },
    ]);
    expect(s3.commandCalls(ListObjectsV2Command)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: "/",
    });
  });

  it("follows the listing's pages to the end", async () => {
    s3.on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: [{ Key: `${prefix}a.pdf`, Size: 1 }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .resolvesOnce({ Contents: [{ Key: `${prefix}b.pdf`, Size: 2 }] });

    expect(await store().list("2027", "opening-number")).toEqual([
      { name: "a.pdf", size: 1 },
      { name: "b.pdf", size: 2 },
    ]);
    expect(s3.commandCalls(ListObjectsV2Command)[1]?.args[0].input.ContinuationToken).toBe(
      "page-2",
    );
  });

  it("leaves out the S3 console's placeholder for the folder itself", async () => {
    s3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: prefix, Size: 0 }] });

    expect(await store().list("2027", "opening-number")).toEqual([]);
  });

  it("lists no files for an item with no folder", async () => {
    s3.on(ListObjectsV2Command).resolves({ KeyCount: 0 });

    expect(await store().list("2027", "finale")).toEqual([]);
  });
});
