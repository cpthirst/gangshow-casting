import { spawnSync } from "node:child_process";

/** The subset of the Claude Code hook payload (JSON on stdin) these hooks use. */
export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  stop_hook_active?: boolean;
}

export async function readInput(): Promise<HookInput> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? (JSON.parse(raw) as HookInput) : {};
}

export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export function run(cmd: string, args: string[]): { ok: boolean; output: string } {
  const r = spawnSync(cmd, args, { cwd: projectDir, encoding: "utf8" });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function git(...args: string[]): string {
  const r = run("git", args);
  return r.ok ? r.output.trim() : "";
}

/** Keep hook feedback short: the agent only needs the end of a long log. */
export function tail(text: string, lines = 40): string {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

const PACKAGES: [prefix: string, filter: string][] = [
  ["apps/web/", "web"],
  ["apps/api/", "api"],
  ["infra/", "infra"],
  ["packages/shared/", "@app/shared"],
  ["tooling/", "tooling"],
];

/** pnpm args that typecheck the package owning `relPath`, or undefined if it isn't code. */
export function typecheckFor(relPath: string): string[] | undefined {
  if (!/\.(ts|vue)$/.test(relPath)) return undefined;
  if (relPath.startsWith(".claude/hooks/")) return ["typecheck:harness"];
  const pkg = PACKAGES.find(([prefix]) => relPath.startsWith(prefix));
  return pkg ? ["--filter", pkg[1], "typecheck"] : undefined;
}

export function shouldRunGate(s: {
  stopHookActive: boolean;
  dirty: boolean;
  aheadOfMain: boolean;
}): boolean {
  // stop_hook_active: we already blocked once and the agent is retrying; let it stop and report
  // rather than loop forever.
  return !s.stopHookActive && (s.dirty || s.aheadOfMain);
}
