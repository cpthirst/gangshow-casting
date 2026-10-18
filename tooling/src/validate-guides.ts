// Checks the maintainer's guides in docs/guides: the required ones exist, and every pnpm
// command in their code blocks runs a real script, so a renamed script can't leave a guide
// pointing at nothing. Prose isn't checked, so a guide can warn against a command.
// Run as part of `pnpm lint:docs`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The guides the maintainer can't do without, and what each is for. */
export const REQUIRED_GUIDES: Record<string, string> = {
  "docs/guides/hosting.md": "the maintainer's guide to the hosted app",
};

// pnpm's own commands that guides use; anything else must be a script.
const PNPM_COMMANDS = new Set(["install", "exec"]);

type Scripts = Set<string>;

function scriptsIn(packageJson: string): { name: string; scripts: Scripts } {
  const parsed: { name?: string; scripts?: Record<string, string> } = JSON.parse(
    readFileSync(packageJson, "utf8"),
  );
  const { name = "", scripts = {} } = parsed;
  return { name, scripts: new Set(Object.keys(scripts)) };
}

/** Each workspace package's scripts, by package name, from pnpm-workspace.yaml's list. */
function workspaceScripts(root: string): Map<string, Scripts> {
  const yaml = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  // Every indented "- item": today only the packages list has any.
  const patterns = [...yaml.matchAll(/^\s+-\s+(\S+)\s*$/gm)].map((match) => match[1] ?? "");
  const dirs = patterns.flatMap((pattern) => {
    if (!pattern.endsWith("/*")) return [pattern];
    const parent = pattern.slice(0, -2);
    if (!existsSync(join(root, parent))) return [];
    return readdirSync(join(root, parent)).map((name) => `${parent}/${name}`);
  });
  const packages = new Map<string, Scripts>();
  for (const dir of dirs) {
    const file = join(root, dir, "package.json");
    if (!existsSync(file)) continue;
    const { name, scripts } = scriptsIn(file);
    packages.set(name, scripts);
  }
  return packages;
}

/** Lines inside fenced code blocks, with their 1-based line numbers. */
function codeLines(text: string): [line: number, code: string][] {
  const found: [number, string][] = [];
  let inBlock = false;
  text.split("\n").forEach((line, index) => {
    if (line.trimStart().startsWith("```")) inBlock = !inBlock;
    else if (inBlock) found.push([index + 1, line]);
  });
  return found;
}

/** Why a pnpm command's words don't name a real script, or undefined if they do. */
function problemWith(
  words: string[],
  rootScripts: Scripts,
  packages: Map<string, Scripts>,
): string | undefined {
  const [first = "", second = "", third = ""] = words;
  if (first === "--filter") {
    const command = `"pnpm --filter ${second} ${third}"`;
    const scripts = packages.get(second);
    if (!scripts) return `${command} names no package in the workspace`;
    if (PNPM_COMMANDS.has(third) || scripts.has(third)) return undefined;
    return `${command} isn't a script in the ${second} package`;
  }
  if (PNPM_COMMANDS.has(first) || rootScripts.has(first)) return undefined;
  return `"pnpm ${first}" isn't a script in package.json`;
}

export function validateGuides(root: string, required = REQUIRED_GUIDES): string[] {
  const errors: string[] = [];
  for (const [path, purpose] of Object.entries(required)) {
    if (!existsSync(join(root, path))) errors.push(`${path}: missing (${purpose})`);
  }

  const guidesDir = join(root, "docs/guides");
  if (!existsSync(guidesDir)) return errors;
  const rootScripts = scriptsIn(join(root, "package.json")).scripts;
  const packages = workspaceScripts(root);
  for (const file of readdirSync(guidesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const path = `docs/guides/${file}`;
    for (const [line, code] of codeLines(readFileSync(join(guidesDir, file), "utf8"))) {
      const command = /(?:^|\s)pnpm\s+([^#]*)/.exec(code)?.[1];
      if (command === undefined) continue;
      const problem = problemWith(command.trim().split(/\s+/), rootScripts, packages);
      if (problem) errors.push(`${path}:${line}: ${problem}`);
    }
  }
  return errors;
}
