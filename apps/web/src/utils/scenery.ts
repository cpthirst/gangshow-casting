import { browserTypeOf, fileTypeOf, type SceneryFile } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** The item's scenery files, as file storage holds them now (production-scenery FR6). */
export const sceneryFilesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-files`;

/** A short-lived link that opens or downloads one of the item's files (FR10). */
export const sceneryFileLinkPath = (itemId: string, name: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-file-link?${new URLSearchParams({ name })}`;

/** Whether choosing the file's tile opens it in a new tab, rather than downloading it. */
export const opensInBrowser = (name: string) => browserTypeOf(name) !== undefined;

/** A tile's name for screen readers: what choosing it does, and the file's type (FR10). */
export function tileLabel(name: string) {
  const action = `${opensInBrowser(name) ? "Open" : "Download"} ${name}`;
  const type = fileTypeOf(name);
  return type ? `${action}, ${type} file` : action;
}

/** Every item's scenery notes, apart from its casting and props notes. */
export const SCENERY_NOTES_PATH = `/api/productions/${PRODUCTION_ID}/scenery-notes`;

/** Where an item's scenery notes are saved. */
export const saveSceneryNotesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-notes`;

const byName = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

/** The files sorted by name, as people read them: ignoring case, numbers in order (FR7). */
export const sortFiles = (files: SceneryFile[]) =>
  [...files].sort((a, b) => byName.compare(a.name, b.name));

// Decimal units, as phones and most computers show file sizes.
const units = [
  { unit: "GB", bytes: 1e9 },
  { unit: "MB", bytes: 1e6 },
  { unit: "KB", bytes: 1e3 },
];

/** A file's size, short enough for a tile: "2.4 MB", "800 KB". */
export function fileSize(bytes: number) {
  const fits = units.find(({ bytes: size }) => bytes >= size);
  if (!fits) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  // Whole kilobytes are enough; bigger units keep one decimal place if it says something.
  const digits = fits.unit === "KB" ? 0 : 1;
  return `${Number((bytes / fits.bytes).toFixed(digits))} ${fits.unit}`;
}
