import { HeadObjectCommand, ListObjectsV2Command, NotFound, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { s3SceneryFileStore } from "./s3-scenery-file-store.ts";

const BUCKET = "made-up-files";
const s3 = mockClient(S3Client);
// Made-up keys, so a link can be signed without AWS.
const credentials = { accessKeyId: "MADEUPKEY", secretAccessKey: "made-up-secret" };
const store = () => s3SceneryFileStore(new S3Client({ region: "eu-west-2", credentials }), BUCKET);
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

describe("links to scenery files in a bucket", () => {
  const linkTo = async (name: string) => {
    const link = await store().linkTo("2027", "opening-number", name);
    return link === undefined ? undefined : new URL(link);
  };

  it("signs a link to the item's file that lasts 5 minutes at most", async () => {
    s3.on(HeadObjectCommand).resolves({ ContentLength: 10 });

    const link = await linkTo("set-plan.pdf");

    expect(link?.host).toBe(`${BUCKET}.s3.eu-west-2.amazonaws.com`);
    expect(link?.pathname).toBe("/2027/opening-number/scenery/set-plan.pdf");
    expect(link?.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(s3.commandCalls(HeadObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Key: `${prefix}set-plan.pdf`,
    });
  });

  it("has a PDF open in the browser, as a PDF, under its stored name", async () => {
    s3.on(HeadObjectCommand).resolves({});

    const link = await linkTo("set-plan.pdf");

    expect(link?.searchParams.get("response-content-type")).toBe("application/pdf");
    expect(link?.searchParams.get("response-content-disposition")).toMatch(
      /^inline; filename="set-plan.pdf"/,
    );
  });

  it("has an HTML file download as bytes, whatever type it was stored with", async () => {
    s3.on(HeadObjectCommand).resolves({ ContentType: "text/html" });

    const link = await linkTo("notes.html");

    expect(link?.searchParams.get("response-content-type")).toBe("application/octet-stream");
    expect(link?.searchParams.get("response-content-disposition")).toMatch(
      /^attachment; filename="notes.html"/,
    );
  });

  it("links to nothing when the file isn't there", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "Not Found", $metadata: {} }));

    expect(await linkTo("set-plan.pdf")).toBeUndefined();
  });
});
