import { describe, expect, it } from "vitest";
import { SceneryFileList, SceneryFileName } from "./scenery.ts";

describe("SceneryFileName", () => {
  it.each(["set-plan.pdf", "Backdrop v2 (final).png", "<b>plan.pdf", "x".repeat(255)])(
    "accepts %s",
    (name) => {
      expect(SceneryFileName.safeParse(name).success).toBe(true);
    },
  );

  it.each([
    ["an empty name", ""],
    ["a name over 255 characters", "x".repeat(256)],
    ["a slash", "plans/set-plan.pdf"],
    ["a closing tag's slash", "<b>plan</b>.pdf"],
    ["a backslash", "plans\\set-plan.pdf"],
    ["a control character", "set\nplan.pdf"],
    ["a delete character", "set\u007fplan.pdf"],
    ["the folder itself", "."],
    ["the folder above", ".."],
  ])("refuses %s, which could reach outside the item's folder", (_, name) => {
    expect(SceneryFileName.safeParse(name).success).toBe(false);
  });
});

describe("SceneryFileList", () => {
  it("is an item's files, each with its name and size in bytes", () => {
    const list = { files: [{ name: "set-plan.pdf", size: 2_400_000 }] };
    expect(SceneryFileList.parse(list)).toEqual(list);
  });

  it("refuses a negative size", () => {
    expect(SceneryFileList.safeParse({ files: [{ name: "a.pdf", size: -1 }] }).success).toBe(false);
  });
});
