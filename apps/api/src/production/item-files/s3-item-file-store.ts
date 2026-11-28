import {
  type DepartmentId,
  FILE_LINK_SECONDS,
  type FileDepartment,
  type ItemFile,
  type ItemFileUpload,
  MAX_ITEM_FILE_BYTES,
} from "@app/shared";
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
import { fileHeadersOf, type LinkOptions } from "./file-headers.ts";
import {
  asItemFiles,
  countsByItem,
  type ItemFileStore,
  isDroppedFile,
  itemFolderOf,
} from "./item-file-store.ts";

// The most keys S3 deletes in one request.
const DELETE_BATCH = 1_000;

/** The department's files in the private bucket infra creates (ADR 0030), one key per file. */
export function s3ItemFileStore(
  s3: S3Client,
  bucket: string,
  department: FileDepartment,
): ItemFileStore {
  const folderOf = (productionId: string, itemId: string) =>
    itemFolderOf(productionId, itemId, department);
  return {
    list: (productionId, itemId) => s3FilesIn(s3, bucket, folderOf(productionId, itemId)),
    async countByItem(productionId) {
      return countsByItem(await keysIn(productionId), department);
    },
    linkTo: (productionId, itemId, name, options) =>
      s3LinkTo(s3, bucket, folderOf(productionId, itemId), name, department, options),
    remove: (productionId, itemId, name) =>
      s3Remove(s3, bucket, folderOf(productionId, itemId), name),
    uploadTo: (productionId, itemId, name, options) =>
      s3UploadTo(s3, bucket, folderOf(productionId, itemId), name, options),
    async keepOnlyItems(productionId, itemIds) {
      const kept = new Set(itemIds);
      const dropped = (await keysIn(productionId))
        .filter((key) => isDroppedFile(key, kept, department))
        .map((key) => ({ Key: `${productionId}/${key}` }));
      for (let at = 0; at < dropped.length; at += DELETE_BATCH) {
        const { Errors = [] } = await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: dropped.slice(at, at + DELETE_BATCH), Quiet: true },
          }),
        );
        // Only how many: a key names a file, which could say something about the show.
        if (Errors.length > 0)
          throw new Error(`${Errors.length} ${department} files weren't deleted`);
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
}

/** The files directly under a prefix in the bucket, such as an item's department folder. */
export async function s3FilesIn(s3: S3Client, bucket: string, prefix: string) {
  const files: ItemFile[] = [];
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
      files.push(...asItemFiles(Key.slice(prefix.length), Size));
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token !== undefined);
  return files;
}

/** A short-lived link to the file of that name under the prefix, sent as the department's
 *  files are; undefined if it isn't there. The name is a valid ItemFileName. */
export async function s3LinkTo(
  s3: S3Client,
  bucket: string,
  prefix: string,
  name: string,
  department: DepartmentId,
  options?: LinkOptions,
) {
  const Key = `${prefix}${name}`;
  if (!(await keyExists(s3, bucket, Key))) return undefined;
  // The link names its type and name itself, so what storage holds can't make it open.
  const { contentType, contentDisposition } = fileHeadersOf(name, department, options);
  const get = new GetObjectCommand({
    Bucket: bucket,
    Key,
    ResponseContentType: contentType,
    ResponseContentDisposition: contentDisposition,
  });
  return getSignedUrl(s3, get, { expiresIn: FILE_LINK_SECONDS });
}

/** A signed form that puts one file at the key of that name under the prefix, or "taken" if
 *  there's one there and it isn't to be replaced (FR9). The name is a valid ItemFileName. */
export async function s3UploadTo(
  s3: S3Client,
  bucket: string,
  prefix: string,
  name: string,
  { replace }: { replace: boolean },
): Promise<ItemFileUpload | "taken"> {
  const Key = `${prefix}${name}`;
  // The bucket overwrites a key without asking, so look first (FR9).
  if (!replace && (await keyExists(s3, bucket, Key))) return "taken";
  // A form only for this key, which the bucket itself refuses over 100 MB (FR8).
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: bucket,
    Key,
    Conditions: [["content-length-range", 0, MAX_ITEM_FILE_BYTES]],
    Expires: FILE_LINK_SECONDS,
  });
  return { url, fields };
}

/** Deletes the file of that name under the prefix, or says it's "gone" if it isn't there. The
 *  name is a valid ItemFileName. */
export async function s3Remove(s3: S3Client, bucket: string, prefix: string, name: string) {
  const Key = `${prefix}${name}`;
  // S3 answers a delete of a missing key as if it worked, so look first, to say it's gone.
  if (!(await keyExists(s3, bucket, Key))) return "gone";
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
  return "removed";
}

async function keyExists(s3: S3Client, bucket: string, Key: string) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }));
    return true;
  } catch (error) {
    if (error instanceof NotFound) return false;
    throw error;
  }
}
