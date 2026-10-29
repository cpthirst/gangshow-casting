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

export type SceneryFile = z.infer<typeof SceneryFile>;
export type SceneryFileList = z.infer<typeof SceneryFileList>;
