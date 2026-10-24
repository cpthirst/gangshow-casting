import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The README describes the repo's parts by name. These checks catch the drift that's easy to
// miss (a new ADR, skill, reviewer, workflow or web folder) for free in the gate, so no agent
// has to re-read the README on every change. Whether the prose still fits is code-reviewer's call.
const root = new URL("../../", import.meta.url);
const readme = readFileSync(new URL("README.md", root), "utf8");
const list = (path: string) => readdirSync(new URL(path, root), { withFileTypes: true });

const adrs = list("docs/adr/")
  .map((f) => f.name)
  .filter((name) => /^\d{4}-.*\.md$/.test(name));
const skills = list(".claude/skills/")
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const agents = list(".claude/agents/").map((f) => f.name.replace(/\.md$/, ""));
const workflows = list(".github/workflows/").map((f) => f.name);
const webFolders = list("apps/web/src/")
  .filter((d) => d.isDirectory())
  .map((d) => `${d.name}/`);

describe("README", () => {
  it.each(adrs)("links %s from the Decisions table", (adr) => {
    expect(readme).toContain(`](docs/adr/${adr})`);
  });

  it.each([...skills, ...agents])("names the %s skill or agent", (name) => {
    expect(readme).toContain(`\`${name}\``);
  });

  it.each(workflows)("describes the %s workflow", (workflow) => {
    expect(readme).toContain(`\`${workflow}\``);
  });

  it.each(webFolders)("shows apps/web/src/%s in the repository layout", (folder) => {
    expect(readme).toMatch(new RegExp(`[├└]── ${folder}`));
  });
});
