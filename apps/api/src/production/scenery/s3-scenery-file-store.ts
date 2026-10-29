import type { SceneryFile } from "@app/shared";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileHeadersOf } from "./file-headers.ts";
import { asSceneryFiles, type SceneryFileStore, sceneryFolderOf } from "./scenery-file-store.ts";

// Long enough to start a download on a slow phone, short enough to be useless if shared
// (production-scenery security NFR).
const LINK_SECONDS = 5 * 60;

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
    async linkTo(productionId, itemId, name) {
      const Key = `${sceneryFolderOf(productionId, itemId)}${name}`;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }));
      } catch (error) {
        if (error instanceof NotFound) return undefined;
        throw error;
      }
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
  };
}
