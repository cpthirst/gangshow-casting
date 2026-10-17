import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { aTestTable, type TestTable } from "./dynamo.fixture.ts";
import { runMove } from "./move-cli.ts";
import { readMoveRecord } from "./move-record.ts";
import { aRole } from "./role-store.contract.ts";
import { aRunningOrder } from "./running-order.fixture.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

// Made-up data only (CLAUDE.md safeguarding).
const cast = aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo" })]);
const roles = {
  productionId: "2027",
  roles: [aRole(3, { name: "Captain Hook", castMemberIds: [12] })],
};

describe("moving a production with the move command", () => {
  let table: TestTable;
  let dataDir: string;
  beforeEach(async () => {
    table = await aTestTable();
    dataDir = await mkdtemp(join(tmpdir(), "move-cli-"));
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(join(dataDir, "2027", "cast.json"), JSON.stringify(cast));
    await writeFile(join(dataDir, "2027", "roles.json"), JSON.stringify(roles));
    await fileRunningOrderStore(dataDir).save(aRunningOrder(1));
  });
  afterEach(async () => {
    await table.drop();
    await rm(dataDir, { recursive: true, force: true });
  });

  let clock = 0;
  const now = () => new Date(Date.UTC(2026, 9, 17, 10, clock++));
  const move = async (...args: string[]) => {
    const lines: string[] = [];
    const code = await runMove(
      args,
      { ...process.env, DATA_DIR: dataDir, DATA_TABLE: table.tableName },
      (line) => lines.push(line),
      now,
    );
    return { code, lines };
  };

  it("copies, then verifies through the API, recording both", async () => {
    expect((await move("copy", "2027")).code).toBe(0);

    const verified = await move("verify", "2027");

    expect(verified.code).toBe(0);
    expect(verified.lines).toContain("cast: 2 match");
    const record = await readMoveRecord(dataDir, "2027");
    expect(record.copiedAt).toBeDefined();
    expect(record.verifiedAt).toBeDefined();
    expect(Date.parse(record.verifiedAt ?? "")).toBeGreaterThan(Date.parse(record.copiedAt ?? ""));
  });

  it("fails verification when the remote database differs, clearing any earlier pass", async () => {
    await move("copy", "2027");
    await move("verify", "2027");
    await table.db.send(
      new PutCommand({
        TableName: table.tableName,
        Item: { pk: "PROD#2027", sk: "CAST#00000012", ...aCastMember(12, { revision: 7 }) },
      }),
    );

    const failed = await move("verify", "2027");

    expect(failed.code).toBe(1);
    expect(failed.lines).toContain("cast: 12 differs");
    expect(failed.lines.join(" ")).not.toMatch(/Jo|Sam|Example|Captain|Hook/);
    expect((await readMoveRecord(dataDir, "2027")).verifiedAt).toBeUndefined();
  });

  it("fails verification before anything has been copied", async () => {
    const failed = await move("verify", "2027");

    expect(failed.code).toBe(1);
    expect(failed.lines).toContain("cast: 1 missing");
  });
});
