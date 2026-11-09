import { z } from "zod";

// A slash or backslash would reach into another folder; control characters can hide that.
const isUnsafe = (char: string) =>
  char === "/" || char === "\\" || char.charCodeAt(0) < 32 || char === "\u007f";

/**
 * The Production departments that keep files per item, each in its own folder,
 * `<production>/<item id>/<department>/` (ADR 0030, ADR 0032). Each has the same routes, named
 * after it (`/scenery-files`, `/sfx-files`, `/wardrobe-files`), and the shapes below.
 */
export const fileDepartments = ["scenery", "sfx", "wardrobe"] as const;
export type FileDepartment = (typeof fileDepartments)[number];

/**
 * A scenery file's name: the last part of its key in file storage, after
 * `<production>/<item id>/scenery/` (ADR 0030), and an SFX or Wardrobe file's, after `…/sfx/` or `…/wardrobe/`. It can't
 * reach outside its item's folder.
 */
export const ItemFileName = z
  .string()
  .min(1)
  .max(255)
  .refine((name) => name !== "." && name !== ".." && ![...name].some(isUnsafe));

export const ItemFile = z.strictObject({
  name: ItemFileName,
  /** In bytes. */
  size: z.number().int().min(0),
});

/** GET /api/productions/{productionId}/items/{itemId}/scenery-files: the item's files, as
 *  file storage holds them now (production-scenery FR6). */
export const ItemFileList = z.strictObject({ files: z.array(ItemFile) });

/** GET /api/productions/{productionId}/scenery-file-counts: how many files each item has, by
 *  item id, as file storage holds them now (production-overview FR14). An item with none may be
 *  left out. */
export const ItemFileCounts = z.strictObject({
  counts: z.record(z.string(), z.number().int().min(0)),
});

/** GET /api/productions/{productionId}/items/{itemId}/scenery-file-link?name=…: a short-lived
 *  link that opens or downloads one file (production-scenery FR10): file storage's, over HTTPS,
 *  or the local API's when run locally. Never anything else the page could be sent to. */
export const ItemFileLink = z.strictObject({
  url: z
    .string()
    .refine((url) => url.startsWith("https://") || url.startsWith("/api/local-files/")),
});

/** The largest file storage keeps: 100 MB, in the decimal units the page shows sizes in
 *  (production-scenery FR8). */
export const MAX_ITEM_FILE_BYTES = 100_000_000;

/** POST /api/productions/{productionId}/items/{itemId}/scenery-uploads: what's about to be
 *  uploaded. A name already on the item is refused unless replace is true (FR9). */
export const ItemFileUploadRequest = z.strictObject({
  // S3 swaps "${filename}" in an upload form's key for the name the browser sends, so a name
  // holding it could land at a key the API never checked.
  name: ItemFileName.refine((name) => !name.includes("${")),
  /** In bytes. */
  size: z.number().int().min(0).max(MAX_ITEM_FILE_BYTES),
  replace: z.boolean().optional(),
});

/** Where the browser sends the file, straight to file storage, as a form with these fields
 *  and then the file (ADR 0030): file storage's, over HTTPS, or the local API's when run
 *  locally. */
export const ItemFileUpload = z.strictObject({
  url: ItemFileLink.shape.url,
  fields: z.record(z.string(), z.string()),
});

/** A file's type, from its name's extension in capitals ("PDF"); undefined if it has none. */
export function fileTypeOf(name: string) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toUpperCase();
}

// Types the browser shows itself and that can't run script: never HTML, SVG or XML.
const browserTypes = new Map([
  ["PDF", "application/pdf"],
  ["JPG", "image/jpeg"],
  ["JPEG", "image/jpeg"],
  ["PNG", "image/png"],
  ["GIF", "image/gif"],
  ["WEBP", "image/webp"],
  ["TXT", "text/plain; charset=utf-8"],
]);

// Audio, which can't run script either, plays in the browser's own player, but only on SFX,
// where it's the cues themselves (production-sfx-wardrobe FR6).
const audioTypes = new Map([
  ["MP3", "audio/mpeg"],
  ["WAV", "audio/wav"],
  ["M4A", "audio/mp4"],
  ["AAC", "audio/aac"],
  ["OGG", "audio/ogg"],
]);

/**
 * The type a department's file opens in the browser as, from its name alone, so neither
 * storage nor whoever uploaded it can make a file open; undefined for a file that only
 * downloads.
 */
export function browserTypeOf(name: string, department: FileDepartment) {
  const type = fileTypeOf(name) ?? "";
  return browserTypes.get(type) ?? (department === "sfx" ? audioTypes.get(type) : undefined);
}

export type ItemFile = z.infer<typeof ItemFile>;
export type ItemFileList = z.infer<typeof ItemFileList>;
export type ItemFileLink = z.infer<typeof ItemFileLink>;
export type ItemFileUploadRequest = z.infer<typeof ItemFileUploadRequest>;
export type ItemFileUpload = z.infer<typeof ItemFileUpload>;
