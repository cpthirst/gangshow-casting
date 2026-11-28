import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  S3Client,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { s3StoreImageStore } from "./s3-store-image-store.ts";

const BUCKET = "made-up-files";
const s3 = mockClient(S3Client);
// Made-up keys, so a link can be signed without AWS.
const credentials = { accessKeyId: "MADEUPKEY", secretAccessKey: "made-up-secret" };
const store = () => s3StoreImageStore(new S3Client({ region: "eu-west-2", credentials }), BUCKET);

beforeEach(() => s3.reset());

describe("stores images in a bucket", () => {
  it("lists the store's own folder, outside every production's", async () => {
    s3.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: "stores/scenery/throne.jpg", Size: 2_400_000 }],
    });

    expect(await store().list("scenery")).toEqual([{ name: "throne.jpg", size: 2_400_000 }]);
    expect(s3.commandCalls(ListObjectsV2Command)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Prefix: "stores/scenery/",
      Delimiter: "/",
    });
  });

  it("signs a link to the store's image, which saves it when asked to", async () => {
    s3.on(HeadObjectCommand).resolves({});

    const link = new URL((await store().linkTo("props", "crown.png", { download: true })) ?? "");

    expect(link.pathname).toBe("/stores/props/crown.png");
    expect(link.searchParams.get("response-content-type")).toBe("image/png");
    expect(link.searchParams.get("response-content-disposition")).toMatch(/^attachment;/);
  });

  it("signs a form that puts the image in the store's folder, and only there", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "", $metadata: {} }));

    const upload = await store().uploadTo("scenery", "castle-backdrop.png", { replace: false });

    expect(upload).not.toBe("taken");
    expect(upload !== "taken" && upload.fields.key).toBe("stores/scenery/castle-backdrop.png");
  });

  it("deletes the image from the store's folder, and only there", async () => {
    s3.on(HeadObjectCommand).resolves({});

    expect(await store().remove("wardrobe", "tunic.jpg")).toBe("removed");
    expect(s3.commandCalls(DeleteObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: BUCKET,
      Key: "stores/wardrobe/tunic.jpg",
    });
  });

  it("says an image already removed is gone, deleting nothing", async () => {
    s3.on(HeadObjectCommand).rejects(new NotFound({ message: "", $metadata: {} }));

    expect(await store().remove("wardrobe", "tunic.jpg")).toBe("gone");
    expect(s3.commandCalls(DeleteObjectCommand)).toEqual([]);
  });
});
