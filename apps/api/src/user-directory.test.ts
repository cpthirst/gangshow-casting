import { describe, expect, it } from "vitest";
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
});
