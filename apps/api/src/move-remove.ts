import { lstat, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProductionId } from "@app/shared";
import { ifExists } from "./files.ts";
import { MOVE_RECORD, readMoveRecord } from "./move-record.ts";

export type Removal =
  | { outcome: "not-verified" | "copied-since" | "changed-since" | "kept" }
  | { outcome: "removed"; files: string[] };

/** Everything a removal would delete in a production's folder (all but the folders
 *  themselves, so links too), relative to it, in name order. */
async function entriesIn(folder: string) {
  const entries =
    (await ifExists(() => readdir(folder, { withFileTypes: true, recursive: true }))) ?? [];
  return entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .sort();
}

/** Whether any entry but the move record (written by verify itself) changed after `time`:
 *  say, the app still running on the files. Such a change was never copied. */
async function changedAfter(folder: string, entries: string[], time: string) {
  for (const entry of entries.filter((name) => name !== MOVE_RECORD)) {
    if ((await lstat(join(folder, entry))).mtimeMs > Date.parse(time)) return true;
  }
  return false;
}

/**
 * Removes a production's local data, the files the app used before the remote database
 * (remote-data FR10). Refused without a passing verification on record, if the copy ran
 * again after it, or if any file changed after it, so the only copy of the show's data is
 * never deleted unproven. Lists everything and asks `confirm` first. Touches nothing else:
 * not other productions, not the remote table. The record is trusted as the maintainer's
 * own: the typed confirmation is the last guard.
 */
export async function removeLocalProduction(
  dataDir: string,
  productionId: string,
  confirm: (files: string[]) => Promise<boolean>,
): Promise<Removal> {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  const { copiedAt, verifiedAt } = await readMoveRecord(dataDir, productionId);
  if (verifiedAt === undefined) return { outcome: "not-verified" };
  if (copiedAt !== undefined && Date.parse(copiedAt) > Date.parse(verifiedAt)) {
    return { outcome: "copied-since" };
  }

  const folder = join(dataDir, productionId);
  const files = await entriesIn(folder);
  if (await changedAfter(folder, files, verifiedAt)) return { outcome: "changed-since" };
  if (!(await confirm(files))) return { outcome: "kept" };
  // Gone is the goal, so a folder already removed meanwhile isn't an error.
  await rm(folder, { recursive: true, force: true });
  return { outcome: "removed", files };
}

/** The removal's outcome, as lines for the maintainer: file names, never their contents. */
export function removalLines(productionId: string, removal: Removal): string[] {
  switch (removal.outcome) {
    case "not-verified":
      return [
        `Nothing removed: verify production ${productionId} first (pnpm --filter api move verify ${productionId}).`,
      ];
    case "copied-since":
      return [
        `Nothing removed: production ${productionId} was copied again after its last passing verification. Verify again first.`,
      ];
    case "changed-since":
      return [
        `Nothing removed: production ${productionId}'s local files changed after its last passing verification. Stop the app, then copy and verify again.`,
      ];
    case "kept":
      return ["Nothing removed: not confirmed."];
    case "removed":
      return [
        `Removed production ${productionId}'s local files:`,
        ...removal.files.map((file) => `  ${file}`),
        "Its data is now only in the remote database.",
      ];
  }
}
