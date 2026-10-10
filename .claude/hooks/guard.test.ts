import { describe, expect, it } from "vitest";
import { decide, type GuardContext } from "./guard.ts";

const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({
  branch: "feat/x",
  readFile: () => undefined,
  ...over,
});

const edit = (file_path: string, old_string: string, new_string: string) => ({
  tool_name: "Edit",
  tool_input: { file_path, old_string, new_string },
});

const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });

describe("guard: protected files", () => {
  it("denies hand-editing the lockfile", () => {
    expect(decide(edit("/repo/pnpm-lock.yaml", "a", "b"), ctx())?.decision).toBe("deny");
  });

  it("denies writing env files but allows .env.example", () => {
    expect(decide(edit("/repo/.env.local", "a", "b"), ctx())?.decision).toBe("deny");
    expect(decide(edit("/repo/.env.example", "a", "b"), ctx())).toBeUndefined();
  });

  it("allows ordinary source edits", () => {
    expect(decide(edit("/repo/apps/api/src/health.ts", "a", "b"), ctx())).toBeUndefined();
  });
});

describe("guard: skipped or focused tests", () => {
  it("denies introducing .skip or .only", () => {
    const d = decide(edit("/r/a.test.ts", 'it("x"', 'it.skip("x"'), ctx());
    expect(d?.decision).toBe("deny");
    expect(decide(edit("/r/a.test.ts", "describe(", "describe.only("), ctx())?.decision).toBe(
      "deny",
    );
  });

  // Changing tests is legitimate when behaviour or design changes; reviewers judge it (ADR 0007).
  it("allows an edit that removes assertions", () => {
    const d = decide(edit("/r/a.test.ts", "expect(a);\nexpect(b);", "expect(a);"), ctx());
    expect(d).toBeUndefined();
  });

  it("allows a Write that replaces a test file with fewer assertions", () => {
    const d = decide(
      { tool_name: "Write", tool_input: { file_path: "/r/a.test.ts", content: "expect(a)" } },
      ctx({ readFile: () => "expect(a); expect(b);" }),
    );
    expect(d).toBeUndefined();
  });

  it("allows adding assertions", () => {
    expect(decide(edit("/r/a.test.ts", "expect(a);", "expect(a);\nexpect(b);"), ctx())).toBe(
      undefined,
    );
  });

  it("ignores .skip in non-test files", () => {
    expect(decide(edit("/r/a.ts", "x", "list.skip(1)"), ctx())).toBeUndefined();
  });
});

describe("guard: git", () => {
  it("denies --no-verify", () => {
    expect(decide(bash("git commit --no-verify -m x"), ctx())?.decision).toBe("deny");
  });

  it("denies committing or pushing while on main", () => {
    expect(decide(bash("git commit -m x"), ctx({ branch: "main" }))?.decision).toBe("deny");
    expect(decide(bash("git push"), ctx({ branch: "main" }))?.decision).toBe("deny");
  });

  it("allows committing on a feature branch", () => {
    expect(decide(bash("git add -A && git commit -m x"), ctx())).toBeUndefined();
  });
});
