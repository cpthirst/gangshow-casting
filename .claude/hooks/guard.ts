// PreToolUse: stop risky actions *before* they happen.
// "deny" blocks outright; the reason is shown to the agent.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { git, type HookInput, readInput } from "./lib.ts";

export interface Decision {
  decision: "deny";
  reason: string;
}

export interface GuardContext {
  branch: string;
  readFile: (path: string) => string | undefined;
}

const SKIP_OR_FOCUS = /\b(?:it|test|describe)\.(?:skip|only|todo)\(/g;

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

export function decide(input: HookInput, ctx: GuardContext): Decision | undefined {
  const t = input.tool_input ?? {};
  switch (input.tool_name) {
    case "Bash":
      return decideBash(String(t.command ?? ""), ctx.branch);
    case "Edit":
    case "Write":
    case "MultiEdit":
      return decideEdit(input.tool_name, t, ctx);
    default:
      return undefined;
  }
}

function decideBash(command: string, branch: string): Decision | undefined {
  if (/--no-verify\b/.test(command)) {
    return { decision: "deny", reason: "Don't bypass git hooks. Fix whatever the hook reports." };
  }
  if (branch === "main" && /\bgit\s+(?:commit|push)\b/.test(command)) {
    return {
      decision: "deny",
      reason: "You're on main. Trunk-based flow: create a branch (feat/…, fix/…, chore/…) first.",
    };
  }
  return undefined;
}

function decideEdit(
  tool: string,
  t: Record<string, unknown>,
  ctx: GuardContext,
): Decision | undefined {
  const path = String(t.file_path ?? "");
  const name = basename(path);

  if (name === "pnpm-lock.yaml") {
    return {
      decision: "deny",
      reason: "Never hand-edit the lockfile; use pnpm add/remove/update.",
    };
  }
  if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
    return { decision: "deny", reason: "Env files hold secrets; agents must not write them." };
  }
  if (!/\.test\.ts$/.test(name)) return undefined;

  const { before, after } = beforeAfter(tool, t, path, ctx);
  if (count(after, SKIP_OR_FOCUS) > count(before, SKIP_OR_FOCUS)) {
    return {
      decision: "deny",
      reason:
        "Don't skip/focus tests to get green. Fix the code, or explain why the test is wrong.",
    };
  }
  return undefined;
}

function beforeAfter(tool: string, t: Record<string, unknown>, path: string, ctx: GuardContext) {
  if (tool === "Write") return { before: ctx.readFile(path) ?? "", after: String(t.content ?? "") };
  const edits = tool === "MultiEdit" ? ((t.edits as Record<string, unknown>[]) ?? []) : [t];
  return {
    before: edits.map((e) => String(e.old_string ?? "")).join("\n"),
    after: edits.map((e) => String(e.new_string ?? "")).join("\n"),
  };
}

if (import.meta.main) {
  const decision = decide(await readInput(), {
    branch: git("branch", "--show-current"),
    readFile: (p) => {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return undefined;
      }
    },
  });
  if (decision) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision.decision,
          permissionDecisionReason: decision.reason,
        },
      }),
    );
  }
}
