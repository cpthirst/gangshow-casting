// PostToolUse (Edit|Write|MultiEdit): format the file, then typecheck its package.
// Exit 2 sends stderr back to the agent so it fixes problems immediately.
import { relative } from "node:path";
import { projectDir, readInput, run, tail, typecheckFor } from "./lib.ts";

const input = await readInput();
const file = String(input.tool_input?.file_path ?? "");
const rel = relative(projectDir, file);

if (!file || rel.startsWith("..")) process.exit(0);

const problems: string[] = [];

if (/\.(ts|js|mjs|vue|json|jsonc|css)$/.test(rel)) {
  const r = run("pnpm", ["exec", "biome", "check", "--write", "--no-errors-on-unmatched", rel]);
  if (!r.ok) problems.push(`biome (issues it could not autofix):\n${tail(r.output)}`);
}

const typecheck = typecheckFor(rel);
if (typecheck) {
  const r = run("pnpm", typecheck);
  if (!r.ok) problems.push(`typecheck:\n${tail(r.output)}`);
}

if (problems.length > 0) {
  process.stderr.write(
    `Post-edit feedback for ${rel}. Fix these before moving on ` +
      `(if you're in the TDD red phase and the code under test doesn't exist yet, that's expected):\n\n` +
      problems.join("\n\n"),
  );
  process.exit(2);
}
