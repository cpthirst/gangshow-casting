import { describe, expect, it } from "vitest";
import { Username } from "./account.ts";

describe("Username", () => {
  it("accepts 1 to 32 letters, digits, dots, hyphens or underscores", () => {
    for (const name of ["p", "pat", "Pat.Smith", "pat-2027", "pat_s", "a".repeat(32)]) {
      expect(Username.safeParse(name).success).toBe(true);
    }
  });

  it("refuses anything else, saying what a username may be", () => {
    for (const name of ["", "pat smith", "pat@example.com", "patrón", "a".repeat(33)]) {
      const result = Username.safeParse(name);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "A username is 1–32 letters, digits, dots, hyphens or underscores.",
      );
    }
  });
});
