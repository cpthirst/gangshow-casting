import { describe, expect, it } from "vitest";
import {
  browserTypeOf,
  fileTypeOf,
  MAX_SCENERY_FILE_BYTES,
  SceneryFileCounts,
  SceneryFileLink,
  SceneryFileList,
  SceneryFileName,
  SceneryUpload,
  SceneryUploadRequest,
} from "./scenery.ts";

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

describe("SceneryFileCounts", () => {
  it("is how many files each item has, by item id", () => {
    const counts = { counts: { "opening-number": 9, finale: 1 } };
    expect(SceneryFileCounts.parse(counts)).toEqual(counts);
  });

  it.each([-1, 1.5])("refuses a count of %s", (count) => {
    expect(SceneryFileCounts.safeParse({ counts: { finale: count } }).success).toBe(false);
  });
});

describe("SceneryFileLink", () => {
  it("is a link that downloads one file", () => {
    const link = { url: "https://files.example/2027/opening-number/scenery/set-plan.pdf?x=1" };
    expect(SceneryFileLink.parse(link)).toEqual(link);
  });

  it("can be a link on the app's own server, as pnpm demo's are", () => {
    const link = { url: "/api/local-files/2027/opening-number/scenery/set-plan.pdf" };
    expect(SceneryFileLink.parse(link)).toEqual(link);
  });

  it.each([
    "javascript:alert(1)",
    "http://files.example/set-plan.pdf",
    "/production/overview",
    "//files.example/set-plan.pdf",
  ])("refuses %s, which isn't file storage", (url) => {
    expect(SceneryFileLink.safeParse({ url }).success).toBe(false);
  });
});

describe("SceneryUploadRequest", () => {
  it("names the file and its size, and may ask to replace one of the same name", () => {
    const request = { name: "set-plan.pdf", size: 2_400_000, replace: true };
    expect(SceneryUploadRequest.parse(request)).toEqual(request);
    expect(SceneryUploadRequest.parse({ name: "set-plan.pdf", size: 0 })).toEqual({
      name: "set-plan.pdf",
      size: 0,
    });
  });

  it("accepts a file of exactly 100 MB, the most file storage keeps", () => {
    expect(MAX_SCENERY_FILE_BYTES).toBe(100_000_000);
    const request = { name: "rig.mov", size: MAX_SCENERY_FILE_BYTES };
    expect(SceneryUploadRequest.safeParse(request).success).toBe(true);
  });

  it.each([
    ["a name that reaches into another folder", { name: "../Finale/plan.pdf", size: 1 }],
    ["a negative size", { name: "a.pdf", size: -1 }],
    ["a size in part bytes", { name: "a.pdf", size: 1.5 }],
    // S3 swaps "${filename}" in an upload form's key for the name the browser sends.
    ["a name file storage would rewrite", { name: "${filename}", size: 1 }],
    ["a name with file storage's rewrite inside it", { name: "plan-${filename}.pdf", size: 1 }],
  ])("refuses %s", (_, request) => {
    expect(SceneryUploadRequest.safeParse(request).success).toBe(false);
  });
});

describe("SceneryUpload", () => {
  it("is where to send the file, and the form fields to send with it", () => {
    const upload = {
      url: "https://files.example/",
      fields: { key: "2027/opening-number/scenery/set-plan.pdf", Policy: "abc" },
    };
    expect(SceneryUpload.parse(upload)).toEqual(upload);
  });

  it("can be the app's own server, as pnpm demo's is", () => {
    const upload = { url: "/api/local-files/2027/opening-number/scenery/set-plan.pdf", fields: {} };
    expect(SceneryUpload.parse(upload)).toEqual(upload);
  });

  it.each(["javascript:alert(1)", "http://files.example/", "//files.example/"])(
    "refuses %s, which isn't file storage",
    (url) => {
      expect(SceneryUpload.safeParse({ url, fields: {} }).success).toBe(false);
    },
  );
});

describe("browserTypeOf", () => {
  it.each([
    ["set-plan.pdf", "application/pdf"],
    ["Backdrop.PNG", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["sketch.gif", "image/gif"],
    ["sketch.webp", "image/webp"],
    ["cues.txt", "text/plain; charset=utf-8"],
  ])("opens %s in the browser as %s", (name, type) => {
    expect(browserTypeOf(name)).toBe(type);
  });

  it.each(["notes.html", "notes.htm", "plan.svg", "plan.xml", "build-list.xlsx", "notes", "pdf"])(
    "leaves %s to download, as it could run script or the browser can't show it",
    (name) => {
      expect(browserTypeOf(name)).toBeUndefined();
    },
  );
});

describe("fileTypeOf", () => {
  it.each([
    ["set-plan.pdf", "PDF"],
    ["build-list.xlsx", "XLSX"],
    ["Backdrop v2.final.png", "PNG"],
  ])("names %s's type %s, from its extension", (name, type) => {
    expect(fileTypeOf(name)).toBe(type);
  });

  it.each(["notes", ".hidden", "trailing."])("gives %s no type", (name) => {
    expect(fileTypeOf(name)).toBeUndefined();
  });
});
