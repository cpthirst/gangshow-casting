import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aRole, behavesAsARoleStore, hook, roleFrom } from "./role-store.contract.ts";
import { fileRoleStore, inMemoryRoleStore } from "./role-store.ts";

describe("in-memory role store", () => {
  behavesAsARoleStore(async (initial) => inMemoryRoleStore(initial));
});

describe("file role store", () => {
  let dataDir: string;
  const rolesFile = (productionId = "2027") => join(dataDir, productionId, "roles.json");
  const writeRoles = async (content: unknown) => {
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(rolesFile(), JSON.stringify(content));
  };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "roles-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  behavesAsARoleStore(async (initial = []) => {
    for (const list of initial) {
      await mkdir(join(dataDir, list.productionId), { recursive: true });
      await writeFile(rolesFile(list.productionId), JSON.stringify(list));
    }
    return fileRoleStore(dataDir);
  });

  it("has no roles before the first is added", async () => {
    expect(await fileRoleStore(dataDir).list("2027")).toEqual({ productionId: "2027", roles: [] });
  });

  it("reads a production's roles", async () => {
    await writeRoles({ productionId: "2027", roles: [aRole(1)] });

    expect((await fileRoleStore(dataDir).list("2027")).roles).toEqual([aRole(1)]);
  });

  it("creates the roles file with the first role, readable by the owner only", async () => {
    const added = roleFrom(await fileRoleStore(dataDir).add("2027", "pirate-sketch", hook));

    expect(added.id).toBe(1);
    expect((await fileRoleStore(dataDir).list("2027")).roles).toEqual([added]);
    expect((await stat(rolesFile())).mode & 0o777).toBe(0o600);
    expect(await readdir(join(dataDir, "2027"))).toEqual(["roles.json"]);
  });

  it("never reuses an id: it carries on from the stored next id", async () => {
    await writeRoles({ productionId: "2027", roles: [aRole(1)], nextId: 30 });

    expect(roleFrom(await fileRoleStore(dataDir).add("2027", "pirate-sketch", hook)).id).toBe(30);
    expect(JSON.parse(await readFile(rolesFile(), "utf8")).nextId).toBe(31);
  });

  it("gives simultaneous adds different ids and keeps both", async () => {
    const store = fileRoleStore(dataDir);

    const [a, b] = await Promise.all([
      store.add("2027", "pirate-sketch", hook),
      store.add("2027", "pirate-sketch", { name: "Smee", size: "support", castMemberIds: [] }),
    ]);

    expect(roleFrom(a).id).not.toBe(roleFrom(b).id);
    expect((await store.list("2027")).roles).toHaveLength(2);
  });

  it("refuses production ids that could reach outside the data folder", async () => {
    await expect(fileRoleStore(dataDir).list("../etc")).rejects.toThrow(/invalid production id/i);
  });

  it("reports an unreadable roles file without quoting it", async () => {
    await writeRoles({ productionId: "2027", roles: [{ name: "Sam Example" }] });

    const error = await fileRoleStore(dataDir)
      .list("2027")
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/roles file for production 2027 is invalid/i);
    expect(String(error)).not.toContain("Sam Example");
  });
});
