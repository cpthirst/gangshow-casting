import { ProductionId } from "@app/shared";
import { dataDirFrom, fileStores, remoteStores, remoteTableFrom } from "./data-stores.ts";
import { copyProduction, copyReportLines, hasLocalData, readLocalProduction } from "./move-copy.ts";
import { recordCopied, recordVerification } from "./move-record.ts";
import { verificationLines, verifyCopy } from "./move-verify.ts";

type Env = Record<string, string | undefined>;
const USAGE = "Usage: pnpm --filter api move <copy|verify> <production id>";

/**
 * Moves a production's data from the local files to the remote table (remote-data E3):
 * `copy`, then `verify`. Reads DATA_DIR, DATA_TABLE and DATA_TABLE_REGION
 * as the API does. Prints only collections, ids and counts, never names. Returns the exit
 * code.
 */
export async function runMove(
  args: string[],
  env: Env,
  print: (line: string) => void,
  now: () => Date = () => new Date(),
): Promise<number> {
  const [command, productionId = ""] = args;
  if (command !== "copy" && command !== "verify") {
    print(USAGE);
    return 1;
  }
  if (!ProductionId.safeParse(productionId).success) {
    print(`"${productionId}" isn't a production id, such as 2027.`);
    return 1;
  }
  const remote = remoteTableFrom(env);
  if (!remote) {
    print("Set DATA_TABLE to the remote table's name (the stack's DataTableName output).");
    return 1;
  }

  const dataDir = dataDirFrom(env);
  // First, so a shell set up for the wrong table or folder is obvious.
  print(`Using table ${remote.table} (${remote.region}) and files at ${dataDir}.`);
  try {
    if (command === "verify") {
      const result = await verifyCopy(
        fileStores(dataDir),
        remoteStores(remote.db, remote.table),
        productionId,
      );
      await recordVerification(dataDir, productionId, result.passed, now());
      for (const line of verificationLines(result)) print(line);
      return result.passed ? 0 : 1;
    }

    const local = await readLocalProduction(dataDir, productionId);
    if (!hasLocalData(local)) {
      print(`No local data found for production ${productionId}: nothing copied.`);
      return 1;
    }
    const report = await copyProduction(remote.db, remote.table, local);
    if (report.outcome === "copied") await recordCopied(dataDir, productionId, now());
    for (const line of copyReportLines(report)) print(line);
    return report.outcome === "copied" ? 0 : 1;
  } catch (error) {
    // Only the error's kind: its message could quote the data, which names children.
    const kind = error instanceof Error ? error.name : "unknown error";
    const what = command === "copy" ? "Copy" : "Verification";
    print(`${what} failed (${kind}). Nothing local was changed; fix the cause and run it again.`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runMove(process.argv.slice(2), process.env, (line) =>
    process.stdout.write(`${line}\n`),
  );
}
