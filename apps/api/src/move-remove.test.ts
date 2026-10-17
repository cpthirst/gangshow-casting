import { mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordCopied, recordVerification } from "./move-record.ts";
import { removalLines, removeLocalProduction } from "./move-remove.ts";

const at = (time: string) => new Date(`2026-10-17T${time}:00.000Z`);

describe("removing a production's local files", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "move-remove-"));
    for (const production of ["2027", "2026"]) {
      await mkdir(join(dataDir, production, "running-order"), { recursive: true });
      await writeFile(join(dataDir, production, "cast.json"), "{}");
      await writeFile(join(dataDir, production, "running-order", "v1.json"), "{}");
    }
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  const folders = () => readdir(dataDir);
  /** Answers the confirmation, remembering which files it was asked about. */
  const answering = (yes: boolean) => {
    const asked: string[][] = [];
    return {
      asked,
      confirm: async (files: string[]) => {
        asked.push(files);
        return yes;
      },
    };
  };
  const answer = (yes: boolean) => answering(yes).confirm;
  // Verified in the future, so files written by the set-up count as before it.
  const verified = async () => {
    await recordCopied(dataDir, "2027", new Date(Date.now() + 60_000));
    await recordVerification(dataDir, "2027", true, new Date(Date.now() + 120_000));
  };

  it("refuses, removing nothing, without a passing verification", async () => {
    await recordCopied(dataDir, "2027", at("10:00"));

    const result = await removeLocalProduction(dataDir, "2027", answer(true));

    expect(result).toEqual({ outcome: "not-verified" });
    expect(await folders()).toContain("2027");
  });

  it("refuses, removing nothing, if the copy ran again since the last pass", async () => {
    await recordCopied(dataDir, "2027", at("10:00"));
    await recordVerification(dataDir, "2027", true, at("10:05"));
    await recordCopied(dataDir, "2027", at("10:10"));

    const result = await removeLocalProduction(dataDir, "2027", answer(true));

    expect(result).toEqual({ outcome: "copied-since" });
    expect(await folders()).toContain("2027");
  });

  it("lists the files it will remove and keeps them all if not confirmed", async () => {
    await verified();
    const { asked, confirm } = answering(false);

    const result = await removeLocalProduction(dataDir, "2027", confirm);

    expect(asked).toEqual([[".move-record.json", "cast.json", join("running-order", "v1.json")]]);
    expect(result).toEqual({ outcome: "kept" });
    expect(await folders()).toContain("2027");
  });

  it("refuses, removing nothing, if a local file changed after the verification", async () => {
    await recordCopied(dataDir, "2027", at("10:00"));
    await recordVerification(dataDir, "2027", true, at("10:05"));
    // Edited after verifying, e.g. by the app still running on the files.
    await utimes(join(dataDir, "2027", "cast.json"), new Date(), new Date());

    const result = await removeLocalProduction(dataDir, "2027", answer(true));

    expect(result).toEqual({ outcome: "changed-since" });
    expect(await readdir(join(dataDir, "2027"))).toContain("cast.json");
  });

  it("lists everything it will remove, not only regular files", async () => {
    await verified();
    await symlink(join(dataDir, "2026"), join(dataDir, "2027", "elsewhere"));
    const { asked, confirm } = answering(false);

    await removeLocalProduction(dataDir, "2027", confirm);

    expect(asked[0]).toContain("elsewhere");
  });

  it("removes only that production's files once confirmed, saying what went", async () => {
    await verified();

    const result = await removeLocalProduction(dataDir, "2027", answer(true));

    expect(result).toEqual({
      outcome: "removed",
      files: [".move-record.json", "cast.json", join("running-order", "v1.json")],
    });
    expect(await folders()).toEqual(["2026"]);
    expect(await readdir(join(dataDir, "2026"))).toEqual(["cast.json", "running-order"]);
  });

  it("explains each outcome in lines that name files, never data", () => {
    expect(removalLines("2027", { outcome: "not-verified" })).toEqual([
      "Nothing removed: verify production 2027 first (pnpm --filter api move verify 2027).",
    ]);
    expect(removalLines("2027", { outcome: "copied-since" })).toEqual([
      "Nothing removed: production 2027 was copied again after its last passing verification. Verify again first.",
    ]);
    expect(removalLines("2027", { outcome: "changed-since" })).toEqual([
      "Nothing removed: production 2027's local files changed after its last passing verification. Stop the app, then copy and verify again.",
    ]);
    expect(removalLines("2027", { outcome: "kept" })).toEqual(["Nothing removed: not confirmed."]);
    expect(removalLines("2027", { outcome: "removed", files: ["cast.json"] })).toEqual([
      "Removed production 2027's local files:",
      "  cast.json",
      "Its data is now only in the remote database.",
    ]);
  });
});
