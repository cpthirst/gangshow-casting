import { describe, expect, it } from "vitest";
import { anAccount } from "./account.fixture.ts";
import { memoryUserDirectory, UsernameTaken } from "./user-directory.ts";

// The in-memory directory stands in for the user pool locally and in tests, so it must
// behave like it where the app relies on that.
describe("the in-memory user directory", () => {
  it("lists every account, with whether each is enabled and its access", async () => {
    const { directory } = memoryUserDirectory([anAccount("jo", { readOnly: true })]);
    await directory.create("sam", "Made-up-1", ["casting"]);
    await directory.create("kim", "Made-up-3", ["stage", "tech"]);
    await directory.create("pat", "Made-up-2", "admin");
    await directory.setEnabled("sam", false);

    expect(await directory.list()).toEqual([
      { username: "jo", enabled: true, access: [] },
      { username: "sam", enabled: false, access: ["casting"] },
      { username: "kim", enabled: true, access: ["stage", "tech"] },
      { username: "pat", enabled: true, access: "admin" },
    ]);
  });

  it("counts an account in no group, or in read-only and another, as read-only, as the API does", async () => {
    const { directory } = memoryUserDirectory([
      anAccount("sam"),
      anAccount("lee", { admin: true, readOnly: true }),
    ]);

    expect((await directory.list()).map((account) => account.access)).toEqual([[], []]);
  });

  it("refuses a username it already has, ignoring case, as the user pool does", async () => {
    const { directory, accounts } = memoryUserDirectory();
    await directory.create("sam", "Made-up-1", ["casting"]);

    await expect(directory.create("Sam", "Made-up-2", ["casting"])).rejects.toThrow(UsernameTaken);
    expect(accounts().map((account) => account.username)).toEqual(["sam"]);
  });

  it("finds and changes an account whatever the case of its username, as the user pool does", async () => {
    const { directory, accounts } = memoryUserDirectory();
    await directory.create("sam", "Made-up-1", ["casting"]);

    await directory.setEnabled("SAM", false);

    expect(await directory.find("Sam")).toEqual({
      username: "sam",
      enabled: false,
      access: ["casting"],
    });
    expect(accounts().map(({ username, enabled }) => ({ username, enabled }))).toEqual([
      { username: "sam", enabled: false },
    ]);
  });

  it("creates a read-only account in no group, with a temporary password", async () => {
    const { directory, accounts } = memoryUserDirectory();

    await directory.create("jo", "Made-up-1", []);

    // In no group: the read-only group is retiring (ADR 0026).
    expect(accounts()[0]).toMatchObject({
      admin: false,
      casting: false,
      readOnly: false,
      passwordKind: "temporary",
    });
  });

  const none = { admin: false, casting: false, stage: false, tech: false, wardrobe: false };
  it.each([
    ["admin", { ...none, admin: true }],
    [["casting"], { ...none, casting: true }],
    [["stage", "tech"], { ...none, stage: true, tech: true }],
    [[], none],
  ] as const)("gives an account the access %j and no other", async (access, groups) => {
    const { directory, accounts } = memoryUserDirectory([
      anAccount("jo", { admin: true, casting: true, wardrobe: true, readOnly: true }),
    ]);

    await directory.setAccess("jo", access === "admin" ? access : [...access]);

    expect(accounts()[0]).toMatchObject({ ...groups, readOnly: false });
    expect((await directory.find("jo"))?.access).toEqual(access);
  });

  it("lists the accounts in the read-only group, and takes one out, leaving it read-only", async () => {
    const { directory } = memoryUserDirectory([
      anAccount("pat", { admin: true }),
      anAccount("sam"),
      anAccount("kit", { casting: true }),
      anAccount("jo", { readOnly: true }),
    ]);

    expect(await directory.inReadOnlyGroup()).toEqual(["jo"]);
    expect(await directory.leaveReadOnlyGroup("jo")).toEqual([]);

    expect(await directory.inReadOnlyGroup()).toEqual([]);
    expect((await directory.find("jo"))?.access).toEqual([]);
  });

  it("takes an account leaving the read-only group out of its other groups too, so it stays read-only", async () => {
    const { directory, accounts } = memoryUserDirectory([
      anAccount("jo", { readOnly: true, admin: true, casting: true, stage: true }),
    ]);

    expect(await directory.leaveReadOnlyGroup("jo")).toEqual(["admin", "casting", "stage"]);

    expect(accounts()[0]).toMatchObject({
      admin: false,
      casting: false,
      stage: false,
      readOnly: false,
    });
    expect((await directory.find("jo"))?.access).toEqual([]);
  });
});
