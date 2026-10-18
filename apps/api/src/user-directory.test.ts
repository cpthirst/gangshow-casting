import { describe, expect, it } from "vitest";
import { anAccount } from "./account.fixture.ts";
import { memoryUserDirectory, UsernameTaken } from "./user-directory.ts";

// The in-memory directory stands in for the user pool locally and in tests, so it must
// behave like it where the app relies on that.
describe("the in-memory user directory", () => {
  it("lists every account, with whether each is enabled and its role", async () => {
    const { directory } = memoryUserDirectory([anAccount("jo", { readOnly: true })]);
    await directory.create("sam", "Made-up-1");
    await directory.create("pat", "Made-up-2");
    await directory.setRole("pat", "admin");
    await directory.setEnabled("sam", false);

    expect(await directory.list()).toEqual([
      { username: "jo", enabled: true, role: "read-only" },
      { username: "sam", enabled: false, role: "casting" },
      { username: "pat", enabled: true, role: "admin" },
    ]);
  });

  it("counts an account in no role, or in read-only and another, as read-only, as the API does", async () => {
    const { directory } = memoryUserDirectory([
      anAccount("sam"),
      anAccount("lee", { admin: true, readOnly: true }),
    ]);

    expect((await directory.list()).map((account) => account.role)).toEqual([
      "read-only",
      "read-only",
    ]);
  });

  it("refuses a username it already has, ignoring case, as the user pool does", async () => {
    const { directory, accounts } = memoryUserDirectory();
    await directory.create("sam", "Made-up-1");

    await expect(directory.create("Sam", "Made-up-2")).rejects.toThrow(UsernameTaken);
    expect(accounts().map((account) => account.username)).toEqual(["sam"]);
  });

  it("finds and changes an account whatever the case of its username, as the user pool does", async () => {
    const { directory, accounts } = memoryUserDirectory();
    await directory.create("sam", "Made-up-1");

    await directory.setEnabled("SAM", false);

    expect(await directory.find("Sam")).toEqual({
      username: "sam",
      enabled: false,
      role: "casting",
    });
    expect(accounts().map(({ username, enabled }) => ({ username, enabled }))).toEqual([
      { username: "sam", enabled: false },
    ]);
  });

  it("makes a new account a Casting Team Member, as team members are today", async () => {
    const { directory, accounts } = memoryUserDirectory();

    await directory.create("sam", "Made-up-1");

    expect(accounts()[0]?.casting).toBe(true);
    expect(await directory.withoutRole()).toEqual([]);
  });

  it.each([
    ["admin", { admin: true, casting: false, readOnly: false }],
    ["casting", { admin: false, casting: true, readOnly: false }],
    ["read-only", { admin: false, casting: false, readOnly: true }],
  ] as const)("gives an account the %s role and no other", async (role, groups) => {
    const { directory, accounts } = memoryUserDirectory([
      anAccount("jo", { admin: true, casting: true, readOnly: true }),
    ]);

    await directory.setRole("jo", role);

    expect(accounts()[0]).toMatchObject(groups);
    expect((await directory.find("jo"))?.role).toBe(role);
  });

  it("lists the accounts in no role, and moves one into Casting Team Member", async () => {
    const { directory, accounts } = memoryUserDirectory([
      anAccount("pat", { admin: true }),
      anAccount("sam"),
      anAccount("kit", { casting: true }),
      anAccount("jo", { readOnly: true }),
    ]);

    expect(await directory.withoutRole()).toEqual(["sam"]);
    await directory.joinCasting("sam");

    expect(await directory.withoutRole()).toEqual([]);
    expect(accounts().find((account) => account.username === "sam")?.casting).toBe(true);
  });
});
