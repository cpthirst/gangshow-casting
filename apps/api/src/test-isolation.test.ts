import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The real data folder holds children's names. Tests that go through the real route table
// must never be able to read or write it (vitest.config.ts points DATA_DIR elsewhere).
describe("test isolation", () => {
  it("points the API's data folder away from the real one during tests", () => {
    const realDataDir = fileURLToPath(new URL("../data", import.meta.url));

    expect(process.env.DATA_DIR).toBeDefined();
    expect(resolve(process.env.DATA_DIR ?? realDataDir)).not.toBe(resolve(realDataDir));
  });

  it("never points the API at a remote table during tests", () => {
    expect(process.env.DATA_TABLE).toBe("");
  });

  it("sends any DynamoDB call a test makes to a closed local port, never to AWS", () => {
    expect(process.env.AWS_ENDPOINT_URL_DYNAMODB).toBe("http://127.0.0.1:9");
  });
});
