import { browserTypeOf, fileTypeOf, MAX_SCENERY_FILE_BYTES, type SceneryFile } from "@app/shared";
import { countInWords } from "./departments.ts";
import { icons } from "./icons.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** The item's scenery files, as file storage holds them now (production-scenery FR6). */
export const sceneryFilesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-files`;

/** One of the item's files, to delete it (FR11). */
export const sceneryFilePath = (itemId: string, name: string) =>
  `${sceneryFilesPath(itemId)}?${new URLSearchParams({ name })}`;

/** Where to ask for an upload of one of the item's files (FR8). */
export const sceneryUploadsPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-uploads`;

/** What the page says of an upload whose name the item already has (FR9). */
export const nameTakenMessage = (name: string) => `There's already a file called ${name}.`;

/** Why the page won't upload a file, before asking the API: too big, or a name the item
 *  already has, compared exactly (FR8, FR9); undefined if it may. */
export function uploadRefusal({ name, size }: { name: string; size: number }, names: string[]) {
  if (size > MAX_SCENERY_FILE_BYTES) return `${name} is over 100 MB, so it wasn't uploaded.`;
  if (names.includes(name)) return nameTakenMessage(name);
  return undefined;
}

/** How many files each item has, for the Overview's Scenery column (production-overview FR14). */
export const SCENERY_FILE_COUNTS_PATH = `/api/productions/${PRODUCTION_ID}/scenery-file-counts`;

/** An item's scenery count on the Overview: "9" over "files", read as "9 scenery files". */
export const sceneryCount = (files: number) =>
  countInWords(files, "file", "files", (word) => `${files} scenery ${word}`);

/** A short-lived link that opens or downloads one of the item's files (FR10). */
export const sceneryFileLinkPath = (itemId: string, name: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/scenery-file-link?${new URLSearchParams({ name })}`;

/** Whether choosing the file's row opens it in a new tab, rather than downloading it. */
export const opensInBrowser = (name: string) => browserTypeOf(name) !== undefined;

/** A file's name for screen readers: what choosing it does, and the file's type (FR10). */
export function fileLabel(name: string) {
  const action = `${opensInBrowser(name) ? "Open" : "Download"} ${name}`;
  const type = fileTypeOf(name);
  return type ? `${action}, ${type} file` : action;
}

// Each icon and the extensions that show it; images all share one.
const typesByIcon = [
  [icons.pdfFile, ["PDF"]],
  [icons.wordFile, ["DOC", "DOCX"]],
  [icons.excelFile, ["XLS", "XLSX"]],
  [icons.powerPointFile, ["PPT", "PPTX"]],
  [
    icons.imageFile,
    ["GIF", "JPG", "JPEG", "PNG", "WEBP", "SVG", "BMP", "TIF", "TIFF", "HEIC", "AVIF"],
  ],
] as const;

/** The icon on a file's row, from its name: its type's own, or the general file icon (FR7). */
export function fileIconOf(name: string) {
  const type = fileTypeOf(name);
  const found = typesByIcon.find(([, types]) => types.some((each) => each === type));
  return found?.[0] ?? icons.file;
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

/** A file's size, short enough for a row: "2.4 MB", "800 KB". */
export function fileSize(bytes: number) {
  const fits = units.find(({ bytes: size }) => bytes >= size);
  if (!fits) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  // Whole kilobytes are enough; bigger units keep one decimal place if it says something.
  const digits = fits.unit === "KB" ? 0 : 1;
  return `${Number((bytes / fits.bytes).toFixed(digits))} ${fits.unit}`;
}
