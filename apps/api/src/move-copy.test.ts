import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import {
  type CopyReport,
  copyReportLines,
  planCopy,
  readLocalProduction,
  rowsOf,
} from "./move-copy.ts";
import { aRole } from "./role-store.contract.ts";
import { aRunningOrder } from "./running-order.fixture.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

// Made-up data only (CLAUDE.md safeguarding).
async function aLocalProduction(dataDir: string) {
  const folder = join(dataDir, "2027");
  await mkdir(folder, { recursive: true });
  const cast = aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo", singing: "Alto" })]);
  await writeFile(join(folder, "cast.json"), JSON.stringify({ ...cast, nextId: 20 }));
  const roles = {
    productionId: "2027",
    roles: [aRole(3, { name: "Captain Hook", castMemberIds: [12] })],
  };
  await writeFile(join(folder, "roles.json"), JSON.stringify(roles));
  const notes = { productionId: "2027", notes: [{ itemId: "finale", text: "Bows", revision: 2 }] };
  await writeFile(join(folder, "item-notes.json"), JSON.stringify(notes));
  const versions = fileRunningOrderStore(dataDir);
  await versions.save(aRunningOrder(1));
  await versions.save(aRunningOrder(2, { first: ["Finale"] }));
  return { cast, roles, notes };
}

describe("copying a production to the remote database", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "move-copy-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it("reads everything a production holds in the files, with its next ids", async () => {
    const { cast, roles, notes } = await aLocalProduction(dataDir);

    const local = await readLocalProduction(dataDir, "2027");

    expect(local.cast).toEqual({ list: cast, nextId: 20 });
    expect(local.roles).toEqual({ list: roles, nextId: 4 });
    expect(local.notes).toEqual(notes);
    expect(local.versions.map((order) => order.version)).toEqual([1, 2]);
  });

  it("plans one row per member, role, role name, note and version, keeping ids and revisions", async () => {
    await aLocalProduction(dataDir);

    const rows = rowsOf(await readLocalProduction(dataDir, "2027"));

    expect(rows.map((row) => row.sk.split("#")[0])).toEqual([
      "CAST",
      "CAST",
      "ROLE",
      "ROLENAME",
      "NOTE",
      "RO",
      "RO",
    ]);
    expect(rows.every((row) => row.pk === "PROD#2027")).toBe(true);
    expect(rows[1]).toMatchObject({ id: 12, singing: "Alto", revision: 1 });
    expect(rows[4]).toMatchObject({ itemId: "finale", revision: 2 });
  });

  it("writes only what's missing, and counts what's already there", async () => {
    await aLocalProduction(dataDir);
    const rows = rowsOf(await readLocalProduction(dataDir, "2027"));

    const plan = planCopy(rows, rows.slice(0, 3));

    expect(plan.toWrite).toEqual(rows.slice(3));
    expect(plan.alreadyThere).toEqual(rows.slice(0, 3));
    expect(plan.differing).toEqual([]);
  });

  it("names, by collection and id, every remote row that differs from the files", async () => {
    await aLocalProduction(dataDir);
    const rows = rowsOf(await readLocalProduction(dataDir, "2027"));
    const changed = rows.map((row) =>
      row.sk.startsWith("CAST#") && row.id === 12 ? { ...row, revision: 5 } : row,
    );

    expect(planCopy(rows, changed).differing).toEqual(["cast: 12"]);
  });

  it("ignores rows that are only in the remote database, such as notes saved there", async () => {
    await aLocalProduction(dataDir);
    const rows = rowsOf(await readLocalProduction(dataDir, "2027"));
    const remoteOnly = {
      pk: "PROD#2027",
      sk: "NOTE#opening",
      itemId: "opening",
      text: "x",
      revision: 1,
    };

    expect(planCopy(rows, [...rows, remoteOnly])).toMatchObject({ toWrite: [], differing: [] });
  });

  it("reports by collection, id and count only, never names or notes", () => {
    const report: CopyReport = {
      productionId: "2027",
      outcome: "copied",
      counts: {
        cast: { copied: 2, alreadyThere: 0 },
        "item notes": { copied: 0, alreadyThere: 1 },
      },
      differing: [],
    };

    expect(copyReportLines(report)).toEqual([
      "Copied production 2027 to the remote database.",
      "cast: 2 copied, 0 already there",
      "item notes: 0 copied, 1 already there",
    ]);
  });

  it("says it wrote nothing, and where it differs, when it refuses", () => {
    const report: CopyReport = {
      productionId: "2027",
      outcome: "refused",
      counts: {},
      differing: ["cast: 12"],
    };

    expect(copyReportLines(report)).toEqual([
      "Nothing copied: the remote database already holds different data for production 2027.",
      "Differs: cast: 12",
    ]);
  });
});
