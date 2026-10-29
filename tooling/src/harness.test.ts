import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The flat `key: value` lines of a file's frontmatter. */
function frontmatter(text: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv?.[1]) data[kv[1]] = (kv[2] ?? "").trim();
  }
  return data;
}

const claudeDir = new URL("../../.claude/", import.meta.url);
const read = (path: string) => frontmatter(readFileSync(new URL(path, claudeDir), "utf8"));

type Rules = { allow: string[]; ask: string[]; deny: string[] };
const readSettings = (): { permissions: Rules } =>
  JSON.parse(readFileSync(new URL("settings.json", claudeDir), "utf8"));

const agents = readdirSync(new URL("agents/", claudeDir)).filter((f) => f.endsWith(".md"));
const skills = readdirSync(new URL("skills/", claudeDir), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe("harness: subagents", () => {
  it.each(agents)("%s has a matching name and a description", (file) => {
    const fm = read(`agents/${file}`);
    expect(fm.name).toBe(file.replace(/\.md$/, ""));
    expect(fm.description?.length).toBeGreaterThan(40);
  });

  it.each(agents.filter((f) => /reviewer|auditor/.test(f)))("%s is read-only", (file) => {
    const tools = (read(`agents/${file}`).tools ?? "").split(/,\s*/);
    expect(tools).not.toContain("Edit");
    expect(tools).not.toContain("Write");
    expect(tools).not.toContain("NotebookEdit");
  });
});

describe("harness: ux-reviewer", () => {
  // Its findings are the user's to decide (ADR 0012), so it must never raise a blocker.
  it("gives advice only, never a blocking verdict", () => {
    const prompt = readFileSync(new URL("agents/ux-reviewer.md", claudeDir), "utf8");
    expect(prompt).toContain("Verdict: ADVISORY");
    expect(prompt).not.toMatch(/\[blocker\]|BLOCKED/);
  });
});

describe("harness: skills", () => {
  it.each(skills)("%s has a matching name and a description", (dir) => {
    const fm = read(`skills/${dir}/SKILL.md`);
    expect(fm.name).toBe(dir);
    expect(fm.description?.length).toBeGreaterThan(40);
  });
});

describe("harness: permissions", () => {
  const { permissions } = readSettings();

  // The user's one "yes" to opening a PR covers pushing its branch and creating it, so neither
  // asks again (ADR 0031). An ask rule outranks an allow, so neither may be asked.
  it("pushes a branch and opens a pull request without asking again", () => {
    expect(permissions.allow).toEqual(
      expect.arrayContaining(["Bash(git push:*)", "Bash(gh pr create:*)"]),
    );
    const asked = permissions.ask.filter((rule) =>
      /^Bash\((git push\b|gh pr( create\b|:|\)))/.test(rule),
    );
    expect(asked).toEqual([]);
  });

  it("asks before merging, closing, reopening, editing or reviewing a pull request", () => {
    expect(permissions.ask).toEqual(
      expect.arrayContaining([
        "Bash(gh pr merge:*)",
        "Bash(gh pr close:*)",
        "Bash(gh pr reopen:*)",
        "Bash(gh pr edit:*)",
        "Bash(gh pr review:*)",
      ]),
    );
  });

  it("never allows force-pushing, deleting a remote branch or pushing to main", () => {
    expect(permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash(git push --force:*)",
        "Bash(git push -f:*)",
        "Bash(git push --force-with-lease:*)",
        "Bash(git push --delete:*)",
        "Bash(git push -d:*)",
        "Bash(git push origin +:*)",
        "Bash(git push origin main:*)",
      ]),
    );
  });
});

describe("harness: batch-stories", () => {
  it("can only be started by the user, never by the model on its own", () => {
    expect(read("skills/batch-stories/SKILL.md")["disable-model-invocation"]).toBe("true");
  });
});
