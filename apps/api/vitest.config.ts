import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// The real data folder (apps/api/data) holds children's names. Every test run gets its
// own empty folder instead, so no test can read or change real data through routes.ts.
export default defineConfig({
  test: { env: { DATA_DIR: mkdtempSync(join(tmpdir(), "gangshow-api-test-data-")) } },
});
