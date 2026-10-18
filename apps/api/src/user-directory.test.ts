import { describe, expect, it } from "vitest";
import { anAccount } from "./account.fixture.ts";
import { memoryUserDirectory, UsernameTaken } from "./user-directory.ts";

// The in-memory directory stands in for the user pool locally and in tests, so it must
// behave like it where the app relies on that.
describe("the in-memory user directory", () => {
  it("lists every account, with whether each is enabled and an admin", async () => {
    const { directory } = memoryUserDirectory();
    await directory.create("sam", "Made-up-1");
    await directory.create("pat", "Made-up-2");
    await directory.setAdmin("pat", true);
    await directory.setEnabled("sam", false);

    expect(await directory.list()).toEqual([
      { username: "sam", enabled: false, admin: false },
      { username: "pat", enabled: true, admin: true },
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

    expect(await directory.find("Sam")).toEqual({ username: "sam", enabled: false, admin: false });
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

  it("keeps an account that loses admin as a Casting Team Member", async () => {
    const { directory } = memoryUserDirectory([anAccount("pat", { admin: true })]);

    await directory.setAdmin("pat", false);

    expect(await directory.withoutRole()).toEqual([]);
  });

  it("never promotes a read-only account when admin is removed from it", async () => {
    const { directory, accounts } = memoryUserDirectory([anAccount("jo", { readOnly: true })]);

    await directory.setAdmin("jo", false);

    expect(accounts()[0]).toMatchObject({ admin: false, casting: false, readOnly: true });
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
