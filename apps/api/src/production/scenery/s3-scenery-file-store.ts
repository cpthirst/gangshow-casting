import { MAX_SCENERY_FILE_BYTES, type SceneryFile } from "@app/shared";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  type S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileHeadersOf } from "./file-headers.ts";
import {
  asSceneryFiles,
  countsByItem,
  isDroppedScenery,
  type SceneryFileStore,
  sceneryFolderOf,
} from "./scenery-file-store.ts";

// Long enough to start a download or upload on a slow phone, short enough to be useless if
// shared (production-scenery security NFR).
const LINK_SECONDS = 5 * 60;
// The most keys S3 deletes in one request.
const DELETE_BATCH = 1_000;

/** Scenery files in the private bucket infra creates (ADR 0030), one key per file. */
export function s3SceneryFileStore(s3: S3Client, bucket: string): SceneryFileStore {
  return {
    async list(productionId, itemId) {
      const prefix = sceneryFolderOf(productionId, itemId);
      const files: SceneryFile[] = [];
      let token: string | undefined;
      // Up to 1,000 keys a page. The delimiter keeps anything in a folder below out of them.
      do {
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            Delimiter: "/",
            ContinuationToken: token,
          }),
        );
        for (const { Key = "", Size = 0 } of page.Contents ?? []) {
          files.push(...asSceneryFiles(Key.slice(prefix.length), Size));
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token !== undefined);
      return files;
    },
    async countByItem(productionId) {
      return countsByItem(await keysIn(productionId));
    },
    async linkTo(productionId, itemId, name) {
      const Key = `${sceneryFolderOf(productionId, itemId)}${name}`;
      if (!(await exists(Key))) return undefined;
      // The link names its type and name itself, so what storage holds can't make it open.
      const { contentType, contentDisposition } = fileHeadersOf(name);
      const get = new GetObjectCommand({
        Bucket: bucket,
        Key,
        ResponseContentType: contentType,
        ResponseContentDisposition: contentDisposition,
      });
      return getSignedUrl(s3, get, { expiresIn: LINK_SECONDS });
    },
    async remove(productionId, itemId, name) {
      const Key = `${sceneryFolderOf(productionId, itemId)}${name}`;
      // S3 answers a delete of a missing key as if it worked, so look first (AC6's "gone").
      if (!(await exists(Key))) return "gone";
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
      return "removed";
    },
    async uploadTo(productionId, itemId, name, { replace }) {
      const Key = `${sceneryFolderOf(productionId, itemId)}${name}`;
      // The bucket overwrites a key without asking, so look first (FR9).
      if (!replace && (await exists(Key))) return "taken";
      // A form only for this key, which the bucket itself refuses over 100 MB (FR8).
      const { url, fields } = await createPresignedPost(s3, {
        Bucket: bucket,
        Key,
        Conditions: [["content-length-range", 0, MAX_SCENERY_FILE_BYTES]],
        Expires: LINK_SECONDS,
      });
      return { url, fields };
    },
    async keepOnlyItems(productionId, itemIds) {
      const kept = new Set(itemIds);
      const dropped = (await keysIn(productionId))
        .filter((key) => isDroppedScenery(key, kept))
        .map((key) => ({ Key: `${productionId}/${key}` }));
      for (let at = 0; at < dropped.length; at += DELETE_BATCH) {
        const { Errors = [] } = await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: dropped.slice(at, at + DELETE_BATCH), Quiet: true },
          }),
        );
        // Only how many: a key names a file, which could say something about the show.
        if (Errors.length > 0) throw new Error(`${Errors.length} scenery files weren't deleted`);
      }
    },
  };

  /** Every key in the production, a page at a time, relative to its folder: one listing for
   *  all its items. */
  async function keysIn(productionId: string) {
    const prefix = `${productionId}/`;
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const { Key = "" } of page.Contents ?? []) keys.push(Key.slice(prefix.length));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token !== undefined);
    return keys;
  }

  async function exists(Key: string) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }));
      return true;
    } catch (error) {
      if (error instanceof NotFound) return false;
      throw error;
    }
  }
}
