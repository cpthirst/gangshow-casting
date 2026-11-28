import { storeFolderOf } from "@app/shared";
import type { S3Client } from "@aws-sdk/client-s3";
import { s3FilesIn, s3LinkTo, s3UploadTo } from "#/production/item-files/s3-item-file-store.ts";
import type { StoreImageStore } from "./store-image-store.ts";

/** The stores' images in the private bucket item files share (ADR 0030, ADR 0043). */
export const s3StoreImageStore = (s3: S3Client, bucket: string): StoreImageStore => ({
  list: (store) => s3FilesIn(s3, bucket, storeFolderOf(store)),
  linkTo: (store, name, options) =>
    s3LinkTo(s3, bucket, storeFolderOf(store), name, store, options),
  uploadTo: (store, name, options) => s3UploadTo(s3, bucket, storeFolderOf(store), name, options),
});
