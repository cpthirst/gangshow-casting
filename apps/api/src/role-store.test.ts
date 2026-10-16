import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddRoleRequest, Role } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileRoleStore, inMemoryRoleStore } from "./role-store.ts";

const hook: AddRoleRequest = { name: "Captain Hook", size: "lead", castMemberIds: [] };
let dataDirForNames: string;

/** The added role, failing the test if the name was refused. */
function roleFrom(result: Role | "name-taken"): Role {
  if (result === "name-taken") throw new Error("expected the role to be added");
  return result;
}

const aRole = (id: number, details: Partial<Role> = {}): Role => ({
  id,
  itemId: "pirate-sketch",
  name: `Role ${id}`,
  size: "support",
  castMemberIds: [],
  revision: 1,
  ...details,
});

describe("in-memory role store", () => {
  it("has no roles for a production nobody has cast yet", async () => {
    expect(await inMemoryRoleStore().list("2027")).toEqual({ productionId: "2027", roles: [] });
  });

  it("adds an uncast role to an item with the next id and revision 1", async () => {
    const store = inMemoryRoleStore([{ productionId: "2027", roles: [aRole(1), aRole(4)] }]);

    const added = await store.add("2027", "pirate-sketch", hook);

    expect(added).toEqual({
      ...hook,
      id: 5,
      itemId: "pirate-sketch",
      castMemberIds: [],
      revision: 1,
    });
    expect((await store.list("2027")).roles).toHaveLength(3);
  });

  it("keeps each production's roles apart", async () => {
    const store = inMemoryRoleStore();

    await store.add("2027", "pirate-sketch", hook);

    expect((await store.list("2028")).roles).toEqual([]);
  });
});

describe("role store casting", () => {
  it("keeps the cast member ids a new role is given", async () => {
    const store = inMemoryRoleStore();

    const added = roleFrom(
      await store.add("2027", "pirate-sketch", { ...hook, castMemberIds: [12] }),
    );

    expect(added.castMemberIds).toEqual([12]);
    expect((await store.list("2027")).roles[0]?.castMemberIds).toEqual([12]);
  });
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

describe.each([
  ["in-memory", () => inMemoryRoleStore()],
  ["file", () => fileRoleStore(dataDirForNames)],
])("%s role store with a name already used", (_kind, makeStore) => {
  beforeEach(async () => {
    dataDirForNames = await mkdtemp(join(tmpdir(), "role-names-"));
  });
  afterEach(() => rm(dataDirForNames, { recursive: true, force: true }));

  it("refuses the same name in the same item, ignoring case and spaces", async () => {
    const store = makeStore();
    await store.add("2027", "pirate-sketch", hook);

    expect(
      await store.add("2027", "pirate-sketch", {
        name: " captain HOOK ",
        size: "cameo",
        castMemberIds: [],
      }),
    ).toBe("name-taken");
    expect((await store.list("2027")).roles).toHaveLength(1);
  });

  it("allows the same name in a different item", async () => {
    const store = makeStore();
    await store.add("2027", "pirate-sketch", {
      name: "Narrator",
      size: "support",
      castMemberIds: [],
    });

    const added = await store.add("2027", "campfire-song", {
      name: "Narrator",
      size: "support",
      castMemberIds: [],
    });

    expect(added).toMatchObject({ itemId: "campfire-song", name: "Narrator" });
  });

  it("lets only one of two simultaneous adds of the same name through", async () => {
    const store = makeStore();

    const results = await Promise.all([
      store.add("2027", "pirate-sketch", hook),
      store.add("2027", "pirate-sketch", hook),
    ]);

    expect(results.filter((result) => result === "name-taken")).toHaveLength(1);
    expect((await store.list("2027")).roles).toHaveLength(1);
  });
});
