import { describe, expect, it } from "vitest";
import { takeUnfakedRequests } from "./test-setup.ts";

describe("test setup", () => {
  it("refuses a request a test hasn't faked, so it never reaches a real API", async () => {
    await expect(fetch("/api/productions/2027/cast")).rejects.toThrow(
      "GET /api/productions/2027/cast wasn't faked",
    );
    // Taken here so this test's own request doesn't fail it.
    expect(takeUnfakedRequests()).toEqual(["GET /api/productions/2027/cast"]);
  });

  it("names a write made with a Request as a write", async () => {
    const save = new Request(`${location.origin}/api/productions/2027/cast`, { method: "POST" });

    await expect(fetch(save)).rejects.toThrow("POST /api/productions/2027/cast wasn't faked");
    expect(takeUnfakedRequests()).toEqual(["POST /api/productions/2027/cast"]);
  });
});
