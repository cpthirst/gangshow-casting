import { describe, expect, it } from "vitest";
import { runUsage } from "./usage-cli.ts";

const run = async (args: string[], env: Record<string, string | undefined>, purged = 0) => {
  const lines: string[] = [];
  const tables: string[] = [];
  const code = await runUsage(args, env, {
    print: (line) => lines.push(line),
    purge: async (table) => {
      tables.push(table);
      return purged;
    },
  });
  return { code, lines, tables };
};

describe("the usage command", () => {
  it("explains its command, and purges nothing, when given another", async () => {
    for (const args of [[], ["remove"], ["purge", "props"]]) {
      const { code, lines, tables } = await run(args, { DATA_TABLE: "GangshowData" });

      expect(code).toBe(1);
      expect(lines).toEqual([
        "Usage: pnpm usage purge    remove the retired Mic plot, Props, Scenery and SFX pages' usage",
      ]);
      expect(tables).toEqual([]);
    }
  });

  it("needs the table's name", async () => {
    const { code, lines, tables } = await run(["purge"], {});

    expect(code).toBe(1);
    expect(lines).toEqual([
      "Set DATA_TABLE to the remote table's name (the stack's DataTableName output).",
    ]);
    expect(tables).toEqual([]);
  });

  it("purges the retired pages' usage from the named table, saying how many it removed", async () => {
    const { code, lines, tables } = await run(["purge"], { DATA_TABLE: "GangshowData" }, 7);

    expect(code).toBe(0);
    expect(tables).toEqual(["GangshowData"]);
    expect(lines).toEqual([
      "Using table GangshowData (eu-west-2).",
      "Removed 7 uses of the retired Mic plot, Props, Scenery and SFX pages. Every other use is kept.",
    ]);
  });

  it("says why it stopped, without AWS's message, when the table can't be reached", async () => {
    const lines: string[] = [];
    const code = await runUsage(
      ["purge"],
      { DATA_TABLE: "GangshowData" },
      {
        print: (line) => lines.push(line),
        purge: async () => {
          throw Object.assign(new Error("secret detail"), { name: "ResourceNotFoundException" });
        },
      },
    );

    expect(code).toBe(1);
    expect(lines.at(-1)).toBe(
      "Couldn't purge the usage (ResourceNotFoundException). Check your AWS profile and DATA_TABLE, then run it again.",
    );
    expect(lines.join("\n")).not.toContain("secret detail");
  });
});
