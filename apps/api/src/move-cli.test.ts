import { describe, expect, it } from "vitest";
import { runMove } from "./move-cli.ts";

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
      expect(lines[0]).toBe("Usage: pnpm --filter api move <copy|verify|remove> <production id>");
    }
  });

  it("needs a production id, checked like the API's", async () => {
    const { code, lines } = await run(["copy", "../etc"], { DATA_TABLE: "GangshowData" });

    expect(code).toBe(1);
    expect(lines).toEqual(['"../etc" isn\'t a production id, such as 2027.']);
  });

  it("needs to know which remote table to use", async () => {
    const { code, lines } = await run(["copy", "2027"]);

    expect(code).toBe(1);
    expect(lines).toEqual([
      "Set DATA_TABLE to the remote table's name (the stack's DataTableName output).",
    ]);
  });
});
