import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { runMove } from "./move-cli.ts";
import { readMoveRecord, recordVerification } from "./move-record.ts";

const run = async (args: string[], env: Record<string, string | undefined> = {}) => {
  const lines: string[] = [];
  const code = await runMove(args, env, (line) => lines.push(line));
  return { code, lines };
};

describe("the move command", () => {
  it("explains its commands when given none or an unknown one", async () => {
    for (const args of [[], ["teleport", "2027"]]) {
      const { code, lines } = await run(args, { DATA_TABLE: "GangshowData" });

      expect(code).toBe(1);
      expect(lines[0]).toBe("Usage: pnpm --filter api move <copy|verify> <production id>");
    }
  });

  it("needs a production id, checked like the API's", async () => {
    const { code, lines } = await run(["copy", "../etc"], { DATA_TABLE: "GangshowData" });

    expect(code).toBe(1);
    expect(lines).toEqual(['"../etc" isn\'t a production id, such as 2027.']);
  });

  it("says it found nothing, and changes nothing, for a production with no local data", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "move-cli-"));

    const { code, lines } = await run(["copy", "2072"], {
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
    });

    expect(code).toBe(1);
    expect(lines).toEqual([
      `Using table GangshowData (eu-west-2) and files at ${dataDir}.`,
      "No local data found for production 2072: nothing copied.",
    ]);
    await rm(dataDir, { recursive: true, force: true });
  });

  it("reports a failure without quoting the data it was reading", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "move-cli-"));
    await mkdir(join(dataDir, "2027", "running-order"), { recursive: true });
    await writeFile(
      join(dataDir, "2027", "running-order", "v1.json"),
      JSON.stringify({ version: 1, leads: "Zed Gone" }),
    );

    const { code, lines } = await run(["copy", "2027"], {
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
    });

    expect(code).toBe(1);
    expect(lines.at(-1)).toBe(
      "Copy failed (ZodError). Nothing local was changed; fix the cause and run it again.",
    );
    expect(lines.join(" ")).not.toMatch(/Zed|Gone/);
    await rm(dataDir, { recursive: true, force: true });
  });

  it("won't verify a production with no local data, and records nothing", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "move-cli-"));

    const { code, lines } = await run(["verify", "2072"], {
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
    });

    expect(code).toBe(1);
    expect(lines.at(-1)).toBe("No local data found for production 2072: nothing to verify.");
    expect(await readMoveRecord(dataDir, "2072")).toEqual({});
    await rm(dataDir, { recursive: true, force: true });
  });

  it("clears an earlier pass if verification can't run", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "move-cli-"));
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(
      join(dataDir, "2027", "cast.json"),
      JSON.stringify(aCastList([aCastMember(1)])),
    );
    await recordVerification(dataDir, "2027", true, new Date());

    // Tests send DynamoDB calls to a closed local port, so reading the remote table fails.
    const { code, lines } = await run(["verify", "2027"], {
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
    });

    expect(code).toBe(1);
    expect(lines.at(-1)).toMatch(/^Verification failed \(\w+\)\./);
    expect(await readMoveRecord(dataDir, "2027")).toEqual({});
    await rm(dataDir, { recursive: true, force: true });
  });

  it("needs to know which remote table to use", async () => {
    const { code, lines } = await run(["copy", "2027"]);

    expect(code).toBe(1);
    expect(lines).toEqual([
      "Set DATA_TABLE to the remote table's name (the stack's DataTableName output).",
    ]);
  });
});
