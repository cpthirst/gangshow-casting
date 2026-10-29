import type { SceneryFile } from "@app/shared";
import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { asSceneryFiles, type SceneryFileStore, sceneryFolderOf } from "./scenery-file-store.ts";

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
  };
}
