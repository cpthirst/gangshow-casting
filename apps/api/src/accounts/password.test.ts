import { describe, expect, it } from "vitest";
import { generatePassword } from "./password.ts";

const samples = Array.from({ length: 500 }, generatePassword);

describe("generatePassword", () => {
  it("meets the user pool's policy: 8 or more characters, with every kind of character", () => {
    for (const password of samples) {
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("uses no characters that are easy to misread when copied out by hand", () => {
    for (const password of samples) expect(password).not.toMatch(/[0O1lI]/);
  });

  it("is different every time", () => {
    expect(new Set(samples).size).toBe(samples.length);
  });
});
