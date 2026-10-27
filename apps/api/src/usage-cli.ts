import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { documentClient } from "./dynamo-table.ts";
import { purgeRetiredPageUses } from "./dynamo-usage-store.ts";

type Env = Record<string, string | undefined>;
type Deps = {
  print: (line: string) => void;
  /** Purges the table's retired page uses, returning how many it removed. */
  purge: (table: string, region: string) => Promise<number>;
};

const USAGE =
  "Usage: pnpm usage purge    remove the retired Mic plot, Props, Scenery and SFX pages' usage";

/**
 * Removes the usage of the Mic plot, Props, Scenery and SFX pages, which became Stage's and
 * Tech's views (production-props AC11), from the table named by DATA_TABLE, with the maintainer's
 * AWS credentials. Run once after the deploy; safe to run again. Returns the exit code.
 */
export async function runUsage(args: string[], env: Env, deps: Deps): Promise<number> {
  const { print } = deps;
  if (args.length !== 1 || args[0] !== "purge") {
    print(USAGE);
    return 1;
  }
  const table = env.DATA_TABLE;
  if (!table) {
    print("Set DATA_TABLE to the remote table's name (the stack's DataTableName output).");
    return 1;
  }
  const region = env.DATA_TABLE_REGION ?? "eu-west-2";

  // First, so a shell set up for the wrong table is obvious.
  print(`Using table ${table} (${region}).`);
  try {
    const purged = await deps.purge(table, region);
    print(
      `Removed ${purged} uses of the retired Mic plot, Props, Scenery and SFX pages. Every other use is kept.`,
    );
    return 0;
  } catch (error) {
    // Only the error's kind: AWS's message can repeat what was sent.
    const kind = error instanceof Error ? error.name : "unknown error";
    print(
      `Couldn't purge the usage (${kind}). Check your AWS profile and DATA_TABLE, then run it again.`,
    );
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runUsage(process.argv.slice(2), process.env, {
    print: (line) => process.stdout.write(`${line}\n`),
    purge: (table, region) =>
      purgeRetiredPageUses(documentClient(new DynamoDBClient({ region })), table),
  });
}
