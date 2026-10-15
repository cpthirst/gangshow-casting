import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./validate-docs.ts";

const claudeDir = new URL("../../.claude/", import.meta.url);
const read = (path: string) =>
  parseFrontmatter(readFileSync(new URL(path, claudeDir), "utf8")).data;

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

describe("harness: skills", () => {
  it.each(skills)("%s has a matching name and a description", (dir) => {
    const fm = read(`skills/${dir}/SKILL.md`);
    expect(fm.name).toBe(dir);
    expect(fm.description?.length).toBeGreaterThan(40);
  });
});

describe("harness: committed permissions", () => {
  // Read from the last commit, not the working tree: batch mode (the batch-stories skill)
  // edits the working copy on purpose, but that override must never be committed.
  const committed = JSON.parse(
    execFileSync("git", ["show", "HEAD:.claude/settings.json"], { encoding: "utf8" }),
  );

  it("asks before pushing or touching pull requests", () => {
    expect(committed.permissions.ask).toEqual(
      expect.arrayContaining(["Bash(git push:*)", "Bash(gh pr:*)"]),
    );
  });

  it("never allows force-pushing or pushing to main", () => {
    expect(committed.permissions.deny).toEqual(
      expect.arrayContaining([
        "Bash(git push --force:*)",
        "Bash(git push -f:*)",
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
