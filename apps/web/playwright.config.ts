import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// Browser layout tests (ADR 0011). They run on their own ports, never against `pnpm dev`,
// which serves real cast data: the API here only sees the made-up data in e2e/data, copied
// fresh for each run so a test that saves can't change the committed copy.
const API_PORT = 3100;
const WEB_PORT = 5180;

// Left in the OS temp folder after the run (a few KB), so a failure can be inspected.
function freshTestData() {
  const dir = mkdtempSync(join(tmpdir(), "gangshow-e2e-"));
  cpSync(new URL("e2e/data", import.meta.url), dir, { recursive: true });
  return dir;
}

// Workers load this config again; the env var hands them the main process's copy.
const dataDir = process.env.E2E_DATA_DIR ?? freshTestData();
process.env.E2E_DATA_DIR = dataDir;

const phone = (width: number) => ({
  name: `phone-${width}`,
  use: { browserName: "chromium" as const, viewport: { width, height: 740 }, isMobile: true },
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${WEB_PORT}` },
  // The smallest phones we support, and a common Android width.
  projects: [phone(320), phone(360)],
  webServer: [
    {
      command: "node ../api/src/dev-server.ts",
      env: { PORT: String(API_PORT), DATA_DIR: dataDir },
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: `vite --port ${WEB_PORT} --strictPort`,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
