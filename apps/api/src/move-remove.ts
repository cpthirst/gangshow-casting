import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProductionId } from "@app/shared";
import { ifExists } from "./files.ts";
import { readMoveRecord } from "./move-record.ts";

export type Removal =
  | { outcome: "not-verified" | "copied-since" | "kept" }
  | { outcome: "removed"; files: string[] };

/** Every file in a production's local folder, relative to it, in name order. */
async function filesIn(folder: string) {
  const entries =
    (await ifExists(() => readdir(folder, { withFileTypes: true, recursive: true }))) ?? [];
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .sort();
}

/**
 * Removes a production's local data, the files the app used before the remote database
 * (remote-data FR10). Refused without a passing verification on record, or if the copy ran
 * again after it, so the only copy of the show's data is never deleted unproven. Lists the
 * files and asks `confirm` first. Touches nothing else: not other productions, not the
 * remote table.
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
  const files = await filesIn(folder);
  if (!(await confirm(files))) return { outcome: "kept" };
  await rm(folder, { recursive: true });
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
