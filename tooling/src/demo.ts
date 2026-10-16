// `pnpm demo`: the whole app on a made-up show (tooling/demo), for trying the casting rules
// without real data. It runs beside `pnpm dev` on its own ports, from a fresh copy each start.
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEMO_API_PORT = 3190;
export const DEMO_WEB_PORT = 5190;

const repo = fileURLToPath(new URL("../../", import.meta.url));

/** A new temporary copy of the demo show, so changes never reach the committed one. */
export function freshDemoData() {
  const dir = mkdtempSync(join(tmpdir(), "gangshow-demo-"));
  cpSync(new URL("../demo/data", import.meta.url), dir, { recursive: true });
  return dir;
}

interface Server {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/** The API on the demo data, then the web app pointed at it and labelled as a demo. */
export function demoServers(dataDir: string): Server[] {
  return [
    {
      name: "api",
      command: process.execPath,
      args: ["src/dev-server.ts"],
      cwd: join(repo, "apps/api"),
      env: { PORT: String(DEMO_API_PORT), DATA_DIR: dataDir },
    },
    {
      name: "web",
      command: "pnpm",
      args: ["exec", "vite", "--port", String(DEMO_WEB_PORT), "--strictPort"],
      cwd: join(repo, "apps/web"),
      env: { API_URL: `http://127.0.0.1:${DEMO_API_PORT}`, VITE_DEMO: "true" },
    },
  ];
}

if (import.meta.main) {
  const servers = demoServers(freshDemoData()).map((server) =>
    spawn(server.command, server.args, {
      cwd: server.cwd,
      env: { ...process.env, ...server.env },
      stdio: "inherit",
    }),
  );
  process.stdout.write(`demo show at http://localhost:${DEMO_WEB_PORT} (Ctrl+C to stop)\n`);
  // If either server stops, stop the other too, rather than leave half a demo running.
  for (const server of servers) server.on("exit", () => process.exit());
  process.on("exit", () => {
    for (const server of servers) server.kill();
  });
  process.on("SIGINT", () => process.exit());
}
