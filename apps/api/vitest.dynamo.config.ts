import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// The database tests (ADR 0016): run by `pnpm test:dynamo` against a local DynamoDB emulator,
// in their own CI job. The emulator accepts any credentials, so these are dummies, and the
// endpoint keeps every call on this machine.
export default defineConfig({
  test: {
    include: ["src/**/*.dynamo.test.ts"],
    env: {
      DATA_DIR: mkdtempSync(join(tmpdir(), "gangshow-api-test-data-")),
      AWS_ENDPOINT_URL_DYNAMODB: process.env.AWS_ENDPOINT_URL_DYNAMODB ?? "http://127.0.0.1:8000",
      AWS_REGION: "eu-west-2",
      AWS_ACCESS_KEY_ID: "emulator",
      AWS_SECRET_ACCESS_KEY: "emulator",
    },
  },
});
