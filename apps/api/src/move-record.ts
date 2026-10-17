import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";
import { writePrivateFile } from "./private-file.ts";

/**
 * When a production was last copied to the remote database, and when a verification last
 * passed (remote-data FR9, FR10). Kept beside the production's local data, never in the
 * repository, so removing the files can check a pass came after the last copy.
 */
export interface MoveRecord {
  copiedAt?: string;
  verifiedAt?: string;
}

const isTime = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

/** The record as stored, or undefined if it isn't one (e.g. a hand edit gone wrong). */
function asMoveRecord(value: unknown): MoveRecord | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record: MoveRecord = {};
  for (const [key, time] of Object.entries(value)) {
    if ((key !== "copiedAt" && key !== "verifiedAt") || !isTime(time)) return undefined;
    record[key] = String(time);
  }
  return record;
}

function recordFileFor(dataDir: string, productionId: string) {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  return join(dataDir, productionId, ".move-record.json");
}

export async function readMoveRecord(dataDir: string, productionId: string): Promise<MoveRecord> {
  const text = await ifExists(() => readFile(recordFileFor(dataDir, productionId), "utf8"));
  if (text === undefined) return {};
  const record = asMoveRecord(parseJson(text));
  if (!record) throw new Error(`Move record for production ${productionId} is invalid`);
  return record;
}

async function writeMoveRecord(dataDir: string, productionId: string, record: MoveRecord) {
  const path = recordFileFor(dataDir, productionId);
  if (record.copiedAt === undefined && record.verifiedAt === undefined) {
    await rm(path, { force: true });
    return;
  }
  await writePrivateFile(path, JSON.stringify(record, null, 2));
}

export async function recordCopied(dataDir: string, productionId: string, at: Date) {
  const record = await readMoveRecord(dataDir, productionId);
  await writeMoveRecord(dataDir, productionId, { ...record, copiedAt: at.toISOString() });
}

/** Records a passing verification, or clears any earlier pass if this one failed. */
export async function recordVerification(
  dataDir: string,
  productionId: string,
  passed: boolean,
  at: Date,
) {
  const { verifiedAt: _earlier, ...record } = await readMoveRecord(dataDir, productionId);
  await writeMoveRecord(
    dataDir,
    productionId,
    passed ? { ...record, verifiedAt: at.toISOString() } : record,
  );
}
