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
