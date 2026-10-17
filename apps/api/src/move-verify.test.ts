import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CastList, ItemNote, RoleList, RunningOrder } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { readMoveRecord, recordCopied, recordVerification } from "./move-record.ts";
import { verificationLines, verifyCopy } from "./move-verify.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";
import { aRole } from "./role-store.contract.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { aRunningOrder } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

// Made-up data only (CLAUDE.md safeguarding).
interface Holding {
  cast?: CastList;
  roles?: RoleList;
  notes?: ItemNote[];
  versions?: RunningOrder[];
}

/** A set of stores holding the given data, standing in for the files or the remote table. */
async function storesWith({ cast, roles, notes = [], versions = [] }: Holding) {
  const castStore = inMemoryCastStore(cast ? [cast] : []);
  const roleStore = inMemoryRoleStore(roles ? [roles] : []);
  const itemNotes = inMemoryItemNoteStore();
  for (const note of notes) {
    for (let revision = 0; revision < note.revision; revision++) {
      await itemNotes.save("2027", note.itemId, revision, note.text);
    }
  }
  return {
    cast: castStore,
    roles: roleStore,
    removeCastMember: uncastThenRemove(castStore, roleStore),
    itemNotes,
    runningOrders: inMemoryRunningOrderStore(versions),
  };
}

const production: Holding = {
  cast: aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo" })]),
  roles: { productionId: "2027", roles: [aRole(3, { castMemberIds: [12] }), aRole(7)] },
  notes: [{ itemId: "finale", text: "Bows", revision: 2 }],
  versions: [aRunningOrder(1), aRunningOrder(2, { first: ["Finale"] })],
};

describe("verifying a copy through the API", () => {
  it("passes when the remote database returns everything the files hold, counting each", async () => {
    const result = await verifyCopy(
      await storesWith(production),
      await storesWith(production),
      "2027",
    );

    expect(result).toMatchObject({ passed: true, problems: [], remoteOnly: [] });
    expect(result.counts).toEqual({
      cast: 2,
      roles: 2,
      "item notes": 1,
      "running order versions": 2,
    });
  });

  it("fails, naming each missing or differing record by collection and id only", async () => {
    const remote = await storesWith({
      ...production,
      cast: aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo", revision: 2 })]),
      roles: { productionId: "2027", roles: [aRole(3, { castMemberIds: [12] })] },
      versions: [aRunningOrder(1)],
    });

    const result = await verifyCopy(await storesWith(production), remote, "2027");

    expect(result.passed).toBe(false);
    expect(result.problems).toEqual([
      "cast: 12 differs",
      "roles: 7 missing",
      "running order versions: 2 missing",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Jo|Example|Bows|Finale/);
  });

  it("notes what only the remote database holds, without failing", async () => {
    const remote = await storesWith({
      ...production,
      notes: [...(production.notes ?? []), { itemId: "opening", text: "Lights", revision: 1 }],
      versions: [...(production.versions ?? []), aRunningOrder(3)],
    });

    const result = await verifyCopy(await storesWith(production), remote, "2027");

    expect(result.passed).toBe(true);
    expect(result.remoteOnly).toEqual(["item notes: opening", "running order versions: 3"]);
  });

  it("never passes when the files hold nothing to compare, such as for a mistyped id", async () => {
    const result = await verifyCopy(await storesWith({}), await storesWith(production), "2027");

    expect(result).toMatchObject({ passed: false, problems: ["nothing in the files to compare"] });
  });

  it.each([
    [
      "an item's notes",
      { notes: [{ itemId: "finale", text: "Bows and encore", revision: 2 }] },
      "item notes: finale differs",
    ],
    [
      "a role",
      { roles: { productionId: "2027", roles: [aRole(3, { castMemberIds: [] }), aRole(7)] } },
      "roles: 3 differs",
    ],
  ])("fails when %s differs", async (_what, change, problem) => {
    const result = await verifyCopy(
      await storesWith(production),
      await storesWith({ ...production, ...change }),
      "2027",
    );

    expect(result.problems).toEqual([problem]);
  });

  it("reports a pass and a failure as lines, with no names", () => {
    expect(
      verificationLines({
        productionId: "2027",
        passed: true,
        counts: { cast: 2 },
        problems: [],
        remoteOnly: ["item notes: opening"],
      }),
    ).toEqual([
      "Verified production 2027: the remote database returns everything the files hold.",
      "cast: 2 match",
      "Only in the remote database (kept): item notes: opening",
    ]);
    expect(
      verificationLines({
        productionId: "2027",
        passed: false,
        counts: {},
        problems: ["roles: 7 missing"],
        remoteOnly: [],
      }),
    ).toEqual([
      "Verification failed for production 2027. Copy again, then verify again.",
      "roles: 7 missing",
    ]);
  });
});

describe("the move record", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "move-record-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  const at = (time: string) => new Date(`2026-10-17T${time}:00.000Z`);

  it("records when a production was last copied and when it last passed verification", async () => {
    await recordCopied(dataDir, "2027", at("10:00"));
    await recordVerification(dataDir, "2027", true, at("10:05"));

    expect(await readMoveRecord(dataDir, "2027")).toEqual({
      copiedAt: "2026-10-17T10:00:00.000Z",
      verifiedAt: "2026-10-17T10:05:00.000Z",
    });
  });

  it("clears an earlier pass when a later verification fails", async () => {
    await recordVerification(dataDir, "2027", true, at("10:05"));
    await recordVerification(dataDir, "2027", false, at("10:10"));

    expect(await readMoveRecord(dataDir, "2027")).toEqual({});
  });

  it("has nothing on record for a production never copied or verified", async () => {
    expect(await readMoveRecord(dataDir, "2027")).toEqual({});
  });
});
