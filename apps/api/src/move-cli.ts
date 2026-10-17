import { createInterface } from "node:readline/promises";
import { ProductionId } from "@app/shared";
import { dataDirFrom, fileStores, remoteStores, remoteTableFrom } from "./data-stores.ts";
import { copyProduction, copyReportLines, hasLocalData, readLocalProduction } from "./move-copy.ts";
import { recordCopied, recordVerification } from "./move-record.ts";
import { removalLines, removeLocalProduction } from "./move-remove.ts";
import { verificationLines, verifyCopy } from "./move-verify.ts";

type Env = Record<string, string | undefined>;
const USAGE = "Usage: pnpm --filter api move <copy|verify|remove> <production id>";

/**
 * Moves a production's data from the local files to the remote table (remote-data E3):
 * `copy`, then `verify`, then `remove`. Reads DATA_DIR, DATA_TABLE and DATA_TABLE_REGION
 * as the API does. Prints only collections, ids and counts, never names. Returns the exit
 * code.
 */
export async function runMove(
  args: string[],
  env: Env,
  print: (line: string) => void,
  now: () => Date = () => new Date(),
  ask: (question: string) => Promise<string> = askOnTerminal,
): Promise<number> {
  const [command, productionId = ""] = args;
  if (command !== "copy" && command !== "verify" && command !== "remove") {
    print(USAGE);
    return 1;
  }
  if (!ProductionId.safeParse(productionId).success) {
    print(`"${productionId}" isn't a production id, such as 2027.`);
    return 1;
  }
  if (command === "remove") return remove(dataDirFrom(env), productionId, print, ask);

  const remote = remoteTableFrom(env);
  if (!remote) {
    print("Set DATA_TABLE to the remote table's name (the stack's DataTableName output).");
    return 1;
  }

  const dataDir = dataDirFrom(env);
  // First, so a shell set up for the wrong table or folder is obvious.
  print(`Using table ${remote.table} (${remote.region}) and files at ${dataDir}.`);
  try {
    const local = await readLocalProduction(dataDir, productionId);
    if (!hasLocalData(local)) {
      const nothing = command === "copy" ? "nothing copied" : "nothing to verify";
      print(`No local data found for production ${productionId}: ${nothing}.`);
      return 1;
    }

    if (command === "verify") {
      const result = await verifyCopy(
        fileStores(dataDir),
        remoteStores(remote.db, remote.table),
        productionId,
      );
      // Shown first, so a problem recording it can't hide what was found.
      for (const line of verificationLines(result)) print(line);
      await recordVerification(dataDir, productionId, result.passed, now());
      return result.passed ? 0 : 1;
    }

    const report = await copyProduction(remote.db, remote.table, local);
    if (report.outcome === "copied") await recordCopied(dataDir, productionId, now());
    for (const line of copyReportLines(report)) print(line);
    return report.outcome === "copied" ? 0 : 1;
  } catch (error) {
    // A verification that couldn't run must not leave an earlier pass to be trusted.
    if (command === "verify") {
      await recordVerification(dataDir, productionId, false, now()).catch(() => undefined);
    }
    // Only the error's kind: its message could quote the data, which names children.
    const kind = error instanceof Error ? error.name : "unknown error";
    const what = command === "copy" ? "Copy" : "Verification";
    print(`${what} failed (${kind}). Nothing local was changed; fix the cause and run it again.`);
    return 1;
  }
}

/** Removes the local files once a verification has passed since the last copy, after
 *  listing them and asking for the production id to be typed: never touches the remote. */
async function remove(
  dataDir: string,
  productionId: string,
  print: (line: string) => void,
  ask: (question: string) => Promise<string>,
) {
  print(`Using files at ${dataDir}.`);
  const removal = await removeLocalProduction(dataDir, productionId, async (files) => {
    print(`These local files for production ${productionId} will be removed:`);
    for (const file of files) print(`  ${file}`);
    const answer = await ask(
      `Type ${productionId} to remove them, or anything else to keep them: `,
    );
    return answer.trim() === productionId;
  });
  for (const line of removalLines(productionId, removal)) print(line);
  return removal.outcome === "removed" ? 0 : 1;
}

async function askOnTerminal(question: string) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(question);
  } finally {
    terminal.close();
  }
}

if (import.meta.main) {
  process.exitCode = await runMove(process.argv.slice(2), process.env, (line) =>
    process.stdout.write(`${line}\n`),
  );
}
