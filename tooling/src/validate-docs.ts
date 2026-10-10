// Validates product docs written by the planning skills:
// story structure (user story + Gherkin AC). Test coverage of ACs is judged at review (ADR 0007).
// Run: node tooling/src/validate-docs.ts  (part of `pnpm check` via `pnpm lint:docs`)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STATUSES = ["draft", "ready", "in-progress", "done"];
const REQUIRED = ["id", "title", "epic", "status"];

export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv?.[1]) data[kv[1]] = (kv[2] ?? "").trim();
  }
  return { data, body: text.slice(match[0].length) };
}

/** Splits the body into `### AC<n>` sections: [["AC1", "Given…"], …]. */
function acceptanceCriteria(body: string): [label: string, text: string][] {
  const parts = body.split(/^### (AC\d+)\b.*$/m);
  const sections: [string, string][] = [];
  for (let i = 1; i < parts.length; i += 2) sections.push([parts[i] ?? "", parts[i + 1] ?? ""]);
  return sections;
}

export function validateStory(path: string, text: string, opts: { feature: string }): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`${path}: ${msg}`);
  const { data, body } = parseFrontmatter(text);

  for (const key of REQUIRED) if (!data[key]) fail(`missing frontmatter: ${key}`);

  const { id = "", status = "" } = data;
  if (status && !STATUSES.includes(status)) {
    fail(`unknown status "${status}" (use ${STATUSES.join(" | ")})`);
  }
  if (id && !new RegExp(`^${opts.feature}\\.E\\d+\\.S\\d+$`).test(id)) {
    fail(`id must look like ${opts.feature}.E<n>.S<n> (got "${id}")`);
  }
  if (!/As an? .+, I want .+, so that .+/i.test(body)) {
    fail('story statement must read "As a <role>, I want <capability>, so that <benefit>."');
  }

  const criteria = acceptanceCriteria(body);
  if (criteria.length === 0 && status !== "draft" && STATUSES.includes(status)) {
    fail(`needs at least one acceptance criterion (### AC1: …) once status is ${status}`);
  }
  for (const [label, section] of criteria) {
    for (const keyword of ["Given", "When", "Then"]) {
      if (!new RegExp(`^\\s*${keyword}\\b`, "m").test(section)) {
        fail(`${label} is missing ${keyword}`);
      }
    }
  }

  return errors;
}

function validateRepo(root: string): { stories: number; errors: string[] } {
  const productDir = join(root, "docs/product");
  if (!existsSync(productDir)) return { stories: 0, errors: [] };

  let stories = 0;
  const errors: string[] = [];
  for (const feature of readdirSync(productDir, { withFileTypes: true })) {
    const storiesDir = join(productDir, feature.name, "stories");
    if (!feature.isDirectory() || !existsSync(storiesDir)) continue;
    for (const file of readdirSync(storiesDir).filter((f) => f.endsWith(".md"))) {
      stories++;
      const rel = `docs/product/${feature.name}/stories/${file}`;
      const text = readFileSync(join(storiesDir, file), "utf8");
      errors.push(...validateStory(rel, text, { feature: feature.name }));
    }
  }
  return { stories, errors };
}

if (import.meta.main) {
  const { stories, errors } = validateRepo(process.cwd());
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n\n${errors.length} docs problem(s).\n`);
    process.exit(1);
  }
  process.stdout.write(`docs: ${stories} stories OK\n`);
}
