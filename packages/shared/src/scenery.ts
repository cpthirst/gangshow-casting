import { z } from "zod";

// A slash or backslash would reach into another folder; control characters can hide that.
const isUnsafe = (char: string) =>
  char === "/" || char === "\\" || char.charCodeAt(0) < 32 || char === "\u007f";

/**
 * A scenery file's name: the last part of its key in file storage, after
 * `<production>/<item id>/scenery/` (ADR 0030). It can't reach outside its item's folder.
 */
export const SceneryFileName = z
  .string()
  .min(1)
  .max(255)
  .refine((name) => name !== "." && name !== ".." && ![...name].some(isUnsafe));

export const SceneryFile = z.strictObject({
  name: SceneryFileName,
  /** In bytes. */
  size: z.number().int().min(0),
});

/** GET /api/productions/{productionId}/items/{itemId}/scenery-files: the item's files, as
 *  file storage holds them now (production-scenery FR6). */
export const SceneryFileList = z.strictObject({ files: z.array(SceneryFile) });

/** GET /api/productions/{productionId}/scenery-file-counts: how many files each item has, by
 *  item id, as file storage holds them now (production-overview FR14). An item with none may be
 *  left out. */
export const SceneryFileCounts = z.strictObject({
  counts: z.record(z.string(), z.number().int().min(0)),
});

/** GET /api/productions/{productionId}/items/{itemId}/scenery-file-link?name=…: a short-lived
 *  link that opens or downloads one file (production-scenery FR10): file storage's, over HTTPS,
 *  or the local API's when run locally. Never anything else the page could be sent to. */
export const SceneryFileLink = z.strictObject({
  url: z
    .string()
    .refine((url) => url.startsWith("https://") || url.startsWith("/api/local-files/")),
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

/**
 * The type a file opens in the browser as, from its name alone, so neither storage nor
 * whoever uploaded it can make a file open; undefined for a file that only downloads.
 */
export const browserTypeOf = (name: string) => browserTypes.get(fileTypeOf(name) ?? "");

export type SceneryFile = z.infer<typeof SceneryFile>;
export type SceneryFileList = z.infer<typeof SceneryFileList>;
export type SceneryFileLink = z.infer<typeof SceneryFileLink>;
