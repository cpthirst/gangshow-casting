import { MAX_SCENERY_FILE_BYTES, SceneryUpload } from "@app/shared";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  S3Client,
} from "@aws-sdk/client-s3";
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

describe("deleting scenery files from a bucket", () => {
  it("deletes the item's file by its key", async () => {
    s3.on(HeadObjectCommand).resolves({});
    s3.on(DeleteObjectCommand).resolves({});

    expect(await store().remove("2027", "opening-number", "set-plan.pdf")).toBe("removed");
    expect(s3.commandCalls(DeleteObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Key: `${prefix}set-plan.pdf`,
    });
  });

  // S3 answers a delete of a missing key as if it worked, so the store looks first.
  it("says a file that isn't there is gone, deleting nothing", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "Not Found", $metadata: {} }));

    expect(await store().remove("2027", "opening-number", "set-plan.pdf")).toBe("gone");
    expect(s3.commandCalls(DeleteObjectCommand)).toEqual([]);
  });
});

describe("uploading scenery files to a bucket", () => {
  /** The rules file storage holds the upload to, as signed into its form. */
  function policyOf(upload: unknown) {
    const { fields } = SceneryUpload.parse(upload);
    const policy = JSON.parse(Buffer.from(fields.Policy ?? "", "base64").toString("utf8"));
    return { fields, policy };
  }

  it("signs a form that puts the file at the item's key, under its own name", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "", $metadata: {} }));

    const upload = await store().uploadTo("2027", "opening-number", "Set Plan.pdf", {
      replace: false,
    });

    const { fields, policy } = policyOf(upload);
    expect(upload).toMatchObject({ url: `https://${BUCKET}.s3.eu-west-2.amazonaws.com/` });
    expect(fields.key).toBe(`${prefix}Set Plan.pdf`);
    expect(policy.conditions).toContainEqual({ key: `${prefix}Set Plan.pdf` });
  });

  it("has file storage refuse a file over 100 MB, whatever sends it", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "", $metadata: {} }));

    const upload = await store().uploadTo("2027", "opening-number", "rig.mov", { replace: false });

    expect(policyOf(upload).policy.conditions).toContainEqual([
      "content-length-range",
      0,
      MAX_SCENERY_FILE_BYTES,
    ]);
  });

  it("lets the form be used for 5 minutes at most", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "", $metadata: {} }));
    const before = Date.now();

    const upload = await store().uploadTo("2027", "opening-number", "a.pdf", { replace: false });

    const expires = Date.parse(policyOf(upload).policy.expiration);
    expect(expires - before).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
  });

  it("says a name the item already has is taken, unless it's to be replaced", async () => {
    s3.on(HeadObjectCommand).resolves({});

    const asked = (replace: boolean) =>
      store().uploadTo("2027", "opening-number", "set-plan.pdf", { replace });

    expect(await asked(false)).toBe("taken");
    expect(s3.commandCalls(HeadObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Key: `${prefix}set-plan.pdf`,
    });
    expect(policyOf(await asked(true)).fields.key).toBe(`${prefix}set-plan.pdf`);
  });
});

describe("counting scenery files in a bucket", () => {
  it("counts each item's own scenery files from one listing of the production", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: "2027/opening-number/scenery/set-plan.pdf" },
        { Key: "2027/opening-number/scenery/backdrop.png" },
        { Key: "2027/finale/scenery/curtain.pdf" },
        // Nested below a scenery folder, another department's, and a folder's placeholder.
        { Key: "2027/finale/scenery/old/curtain-v1.pdf" },
        { Key: "2027/finale/sfx/thunder.mp3" },
        { Key: "2027/finale/scenery/" },
      ],
    });

    expect(await store().countByItem("2027")).toEqual({ "opening-number": 2, finale: 1 });
    expect(s3.commandCalls(ListObjectsV2Command)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Prefix: "2027/",
    });
  });

  it("follows the listing's pages to the end", async () => {
    s3.on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: [{ Key: "2027/finale/scenery/a.pdf" }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .resolvesOnce({ Contents: [{ Key: "2027/finale/scenery/b.pdf" }] });

    expect(await store().countByItem("2027")).toEqual({ finale: 2 });
    expect(s3.commandCalls(ListObjectsV2Command)[1]?.args[0].input.ContinuationToken).toBe(
      "page-2",
    );
  });
});

describe("deleting removed items' scenery files from a bucket", () => {
  const deleted = () =>
    s3
      .commandCalls(DeleteObjectsCommand)
      .flatMap((call) => call.args[0].input.Delete?.Objects?.map(({ Key }) => Key) ?? []);

  it("deletes every scenery key of the items not kept, from one listing of the production", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: "2027/opening-number/scenery/set-plan.pdf" },
        { Key: "2027/cut-sketch/scenery/set-plan.pdf" },
        // Nested below its scenery folder, and the folder's placeholder: all of its scenery.
        { Key: "2027/cut-sketch/scenery/old/backdrop.png" },
        { Key: "2027/cut-sketch/scenery/" },
        // Another department's file, and one at the production's top, aren't scenery.
        { Key: "2027/cut-sketch/sfx/thunder.mp3" },
        { Key: "2027/readme.txt" },
      ],
    });
    s3.on(DeleteObjectsCommand).resolves({});

    await store().keepOnlyItems("2027", ["opening-number"]);

    expect(s3.commandCalls(ListObjectsV2Command)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Prefix: "2027/",
    });
    expect(s3.commandCalls(DeleteObjectsCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Delete: {
        Objects: [
          { Key: "2027/cut-sketch/scenery/set-plan.pdf" },
          { Key: "2027/cut-sketch/scenery/old/backdrop.png" },
          { Key: "2027/cut-sketch/scenery/" },
        ],
        Quiet: true,
      },
    });
  });

  it("asks to delete nothing when every item with files is kept", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: "2027/opening-number/scenery/set-plan.pdf" }],
    });

    await store().keepOnlyItems("2027", ["opening-number"]);

    expect(s3.commandCalls(DeleteObjectsCommand)).toEqual([]);
  });

  it("follows the listing's pages, and deletes at most 1,000 keys a request", async () => {
    const keys = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => ({
        Key: `2027/cut-sketch/scenery/${from + i}.pdf`,
      }));
    s3.on(ListObjectsV2Command)
      .resolvesOnce({ Contents: keys(0, 1_000), IsTruncated: true, NextContinuationToken: "p2" })
      .resolvesOnce({ Contents: keys(1_000, 1_001) });
    s3.on(DeleteObjectsCommand).resolves({});

    await store().keepOnlyItems("2027", []);

    const sizes = s3
      .commandCalls(DeleteObjectsCommand)
      .map((call) => call.args[0].input.Delete?.Objects?.length);
    expect(sizes).toEqual([1_000, 1]);
    expect(deleted()).toHaveLength(1_001);
  });

  // S3 answers a batch it couldn't wholly delete as a success, listing the keys it kept.
  it("fails when the bucket couldn't delete a key, so the next save tries again", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: "2027/cut-sketch/scenery/set-plan.pdf" }],
    });
    s3.on(DeleteObjectsCommand).resolves({
      Errors: [{ Key: "2027/cut-sketch/scenery/set-plan.pdf", Code: "AccessDenied" }],
    });

    await expect(store().keepOnlyItems("2027", [])).rejects.toThrow();
  });
});
