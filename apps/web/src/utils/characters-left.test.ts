import { MAX_NOTE_LENGTH } from "@app/shared";
import { describe, expect, it } from "vitest";
import { charactersLeft } from "./characters-left.ts";

const typed = (length: number) => "x".repeat(length);

describe("charactersLeft", () => {
  it("says nothing until fewer than 50 characters are left", () => {
    expect(charactersLeft(typed(MAX_NOTE_LENGTH - 50))).toBe("");
    expect(charactersLeft(typed(MAX_NOTE_LENGTH - 49))).toBe("49 characters left");
  });

  it("says 1 character left, not 1 characters", () => {
    expect(charactersLeft(typed(MAX_NOTE_LENGTH - 1))).toBe("1 character left");
  });

  it("counts the text as it will be saved, without the spaces round it", () => {
    expect(charactersLeft(` ${typed(MAX_NOTE_LENGTH)} `)).toBe("0 characters left");
  });

  it("says none are left at the limit, and how many too many past it", () => {
    expect(charactersLeft(typed(MAX_NOTE_LENGTH))).toBe("0 characters left");
    expect(charactersLeft(typed(MAX_NOTE_LENGTH + 1))).toBe("1 character too many");
    expect(charactersLeft(typed(MAX_NOTE_LENGTH + 3))).toBe("3 characters too many");
  });
});
