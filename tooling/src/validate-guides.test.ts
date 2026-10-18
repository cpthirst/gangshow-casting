import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_GUIDES, validateGuides } from "./validate-guides.ts";

const fence = "```";
const guide = (...commands: string[]) =>
  `# A guide\n\nRun these:\n\n${fence}bash\n${commands.join("\n")}\n${fence}\n`;

describe("validateGuides", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true });
  });

  function repoWith(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "validate-guides-"));
    roots.push(root);
    const all = {
      "package.json": JSON.stringify({ scripts: { dev: "", "infra:deploy": "" } }),
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - infra\n",
      "apps/api/package.json": JSON.stringify({ name: "api", scripts: { account: "" } }),
      "infra/package.json": JSON.stringify({ name: "infra", scripts: { synth: "" } }),
      ...files,
    };
    for (const [path, text] of Object.entries(all)) {
      const file = join(root, path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, text);
    }
    return root;
  }

  it("requires the guide to the hosted app", () => {
    expect(Object.keys(REQUIRED_GUIDES)).toContain("docs/guides/hosting.md");
  });

  it("fails when a required guide is missing", () => {
    const root = repoWith({});
    expect(validateGuides(root, { "docs/guides/a.md": "a guide" })).toEqual([
      "docs/guides/a.md: missing (a guide)",
    ]);
  });

  it("accepts root and package scripts, pnpm's own install and exec, and env prefixes", () => {
    const root = repoWith({
      "docs/guides/hosting.md": guide(
        "pnpm install",
        "AWS_PROFILE=x pnpm infra:deploy   # deploys",
        "pnpm --filter api account admin <your username>",
        "pnpm --filter infra exec cdk bootstrap",
        "DATA_TABLE=<table> pnpm dev",
      ),
    });
    expect(validateGuides(root)).toEqual([]);
  });

  it("names a root script the guide uses that doesn't exist", () => {
    const root = repoWith({ "docs/guides/hosting.md": guide("pnpm deploy") });
    expect(validateGuides(root)).toEqual([
      'docs/guides/hosting.md:6: "pnpm deploy" isn\'t a script in package.json',
    ]);
  });

  it("names a package script the guide uses that doesn't exist", () => {
    const root = repoWith({ "docs/guides/hosting.md": guide("pnpm --filter api move copy 2027") });
    expect(validateGuides(root)).toEqual([
      'docs/guides/hosting.md:6: "pnpm --filter api move" isn\'t a script in the api package',
    ]);
  });

  it("names a package the guide filters on that doesn't exist", () => {
    const root = repoWith({ "docs/guides/hosting.md": guide("pnpm --filter nope test") });
    expect(validateGuides(root)).toEqual([
      'docs/guides/hosting.md:6: "pnpm --filter nope test" names no package in the workspace',
    ]);
  });

  it("checks every guide, not only the required ones", () => {
    const root = repoWith({
      "docs/guides/hosting.md": guide("pnpm dev"),
      "docs/guides/other.md": guide("pnpm gone"),
    });
    expect(validateGuides(root)).toEqual([
      'docs/guides/other.md:6: "pnpm gone" isn\'t a script in package.json',
    ]);
  });

  it("only checks commands in code blocks, so prose can warn against one", () => {
    const root = repoWith({ "docs/guides/hosting.md": "Never run `pnpm deploy`.\n" });
    expect(validateGuides(root)).toEqual([]);
  });
});
