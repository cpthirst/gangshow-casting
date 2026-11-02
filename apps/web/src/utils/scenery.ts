import {
  browserTypeOf,
  type FileDepartment,
  fileTypeOf,
  MAX_SCENERY_FILE_BYTES,
  type SceneryFile,
} from "@app/shared";
import { countInWords } from "./departments.ts";
import { icons } from "./icons.ts";
import {
  departmentNotesPath,
  itemFileLinkPath,
  itemFilePath,
  itemFilesPath,
  itemUploadsPath,
  saveDepartmentNotesPath,
} from "./item-files.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** The item's scenery files, as file storage holds them now (production-scenery FR6). */
export const sceneryFilesPath = (itemId: string) => itemFilesPath("scenery", itemId);

/** One of the item's files, to delete it (FR11). */
export const sceneryFilePath = (itemId: string, name: string) =>
  itemFilePath("scenery", itemId, name);

/** Where to ask for an upload of one of the item's files (FR8). */
export const sceneryUploadsPath = (itemId: string) => itemUploadsPath("scenery", itemId);

/** What the page asks before an upload replaces the item's file of the same name (FR9):
 *  there's no history, so the old copy is gone for good. */
export const replaceQuestion = (name: string) =>
  `Replace ${name}? The old copy can't be brought back.`;

/** Why the page won't upload a file, before asking the API: it's too big (FR8); undefined if
 *  it may. */
export function uploadRefusal({ name, size }: { name: string; size: number }) {
  if (size > MAX_SCENERY_FILE_BYTES) return `${name} is over 100 MB, so it wasn't uploaded.`;
  return undefined;
}

/** How many files each item has, for the Overview's Scenery column (production-overview FR14). */
export const SCENERY_FILE_COUNTS_PATH = `/api/productions/${PRODUCTION_ID}/scenery-file-counts`;

/** An item's scenery count on the Overview: "9" over "files", read as "9 scenery files". */
export const sceneryCount = (files: number) =>
  countInWords(files, "file", "files", (word) => `${files} scenery ${word}`);

/** A short-lived link that opens or downloads one of the item's files (FR10). */
export const sceneryFileLinkPath = (itemId: string, name: string) =>
  itemFileLinkPath("scenery", itemId, name);

/** Whether choosing the department's file opens it in a new tab, rather than downloading it. */
export const opensInBrowser = (name: string, department: FileDepartment) =>
  browserTypeOf(name, department) !== undefined;

/** A file's name for screen readers: what choosing it does, and the file's type (FR10). */
export function fileLabel(name: string, department: FileDepartment) {
  const action = `${opensInBrowser(name, department) ? "Open" : "Download"} ${name}`;
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

/** The icon on a department's file's row, from its name: its type's own, or the general file
 *  icon (FR7). Audio has its own only where it plays in the browser, on SFX
 *  (production-sfx-wardrobe FR6); elsewhere it only downloads. */
export function fileIconOf(name: string, department: FileDepartment) {
  if (browserTypeOf(name, department)?.startsWith("audio/")) return icons.audioFile;
  const type = fileTypeOf(name);
  const found = typesByIcon.find(([, types]) => types.some((each) => each === type));
  return found?.[0] ?? icons.file;
}

/** Every item's scenery notes, apart from its casting and props notes. */
export const SCENERY_NOTES_PATH = departmentNotesPath("scenery");

/** Where an item's scenery notes are saved. */
export const saveSceneryNotesPath = (itemId: string) => saveDepartmentNotesPath("scenery", itemId);

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
