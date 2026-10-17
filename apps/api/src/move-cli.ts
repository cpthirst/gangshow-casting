import { ProductionId } from "@app/shared";
import { dataDirFrom, remoteTableFrom } from "./data-stores.ts";
import { copyProduction, copyReportLines, readLocalProduction } from "./move-copy.ts";

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
): Promise<number> {
  const [command, productionId = ""] = args;
  if (command !== "copy") {
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

  const local = await readLocalProduction(dataDirFrom(env), productionId);
  const report = await copyProduction(remote.db, remote.table, local);
  for (const line of copyReportLines(report)) print(line);
  return report.outcome === "copied" ? 0 : 1;
}

if (import.meta.main) {
  process.exitCode = await runMove(process.argv.slice(2), process.env, (line) =>
    process.stdout.write(`${line}\n`),
  );
}
