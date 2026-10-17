import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// The real data folder (apps/api/data) holds children's names. Every test run gets its
// own empty folder instead, so no test can read or change real data through routes.ts.
// The database tests need an emulator, so they run apart (vitest.dynamo.config.ts, ADR 0016).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.dynamo.test.ts"],
    // Never the real remote table either, even if the shell has DATA_TABLE set; and any
    // DynamoDB or Cognito call a test makes by mistake goes to a closed local port, not to AWS.
    env: {
      DATA_DIR: mkdtempSync(join(tmpdir(), "gangshow-api-test-data-")),
      DATA_TABLE: "",
      AWS_ENDPOINT_URL_DYNAMODB: "http://127.0.0.1:9",
      AWS_ENDPOINT_URL_COGNITO_IDENTITY_PROVIDER: "http://127.0.0.1:9",
    },
  },
});
