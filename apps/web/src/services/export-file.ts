// Saving an export: the file name and the download, the same for every export.

/** Hands the user a file to keep, as a click on a link to it would. */
export function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** "Gang Show 2027 casting grid 2027-03-12.xlsx": the production, what the file holds and the
 *  day, on the user's clock, with characters a file name can't hold swapped for spaces. */
export function exportFileName(production: string, day: Date, holds: string, extension: string) {
  const name = production
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return `${name} ${holds} ${date}.${extension}`;
}
