import { describe, expect, it } from "vitest";
import { restoreAdmin, setUpCheckAccounts } from "./admin-account.ts";
import { memoryUserDirectory } from "./user-directory.ts";

const pat = (changes = {}) => ({
  username: "pat",
  enabled: true,
  admin: true,
  casting: false,
  readOnly: false,
  password: "Old-password-9",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
  ...changes,
});

let generated = 0;
const newPassword = () => `Made-up-${++generated}`;

describe("restoreAdmin", () => {
  it("creates a missing account as an admin with a temporary password", async () => {
    const { directory, accounts } = memoryUserDirectory();

    const result = await restoreAdmin(directory, "pat", newPassword);

    expect(result).toEqual({ created: true, password: expect.stringMatching(/^Made-up-/) });
    expect(accounts()).toEqual([
      expect.objectContaining({
        username: "pat",
        enabled: true,
        admin: true,
        password: result.password,
        passwordKind: "temporary",
      }),
    ]);
  });

  it("enables a disabled account and makes it an admin", async () => {
    const { directory, accounts } = memoryUserDirectory([pat({ enabled: false, admin: false })]);

    const result = await restoreAdmin(directory, "pat", newPassword);

    expect(result.created).toBe(false);
    expect(accounts()).toEqual([expect.objectContaining({ enabled: true, admin: true })]);
  });

  it("makes an account that lost admin an admin again", async () => {
    const { directory, accounts } = memoryUserDirectory([pat({ admin: false })]);

    await restoreAdmin(directory, "pat", newPassword);

    expect(accounts()).toEqual([expect.objectContaining({ admin: true })]);
  });

  it("resets an existing account's password to a new temporary one and signs it out everywhere", async () => {
    const { directory, accounts } = memoryUserDirectory([pat()]);

    const result = await restoreAdmin(directory, "pat", newPassword);

    expect(result.password).not.toBe("Old-password-9");
    expect(accounts()).toEqual([
      expect.objectContaining({
        password: result.password,
        passwordKind: "temporary",
        signedOutEverywhere: 1,
      }),
    ]);
  });
});

describe("setUpCheckAccounts", () => {
  const usernames = { admin: "check-admin", member: "check-member", readOnly: "check-read-only" };

  it("makes an admin, a Casting Team Member and a Read-Only Team Member, all with permanent passwords", async () => {
    const { directory, accounts } = memoryUserDirectory();

    const passwords = await setUpCheckAccounts(directory, usernames, newPassword);

    expect(accounts()).toEqual([
      expect.objectContaining({
        username: "check-admin",
        enabled: true,
        admin: true,
        password: passwords.admin,
        passwordKind: "permanent",
      }),
      expect.objectContaining({
        username: "check-member",
        enabled: true,
        admin: false,
        // The post-deploy check's member is a Casting Team Member (ADR 0020).
        casting: true,
        password: passwords.member,
        passwordKind: "permanent",
      }),
      expect.objectContaining({
        username: "check-read-only",
        enabled: true,
        // In no group, so with no permissions (ADR 0026).
        admin: false,
        casting: false,
        readOnly: false,
        password: passwords.readOnly,
        passwordKind: "permanent",
      }),
    ]);
    expect(new Set(Object.values(passwords)).size).toBe(3);
  });

  it("puts existing check accounts back the same way", async () => {
    const { directory, accounts } = memoryUserDirectory([
      pat({ username: "check-admin", enabled: false, admin: false }),
      pat({ username: "check-member", admin: true }),
      pat({ username: "check-read-only", enabled: false, admin: true }),
    ]);

    const passwords = await setUpCheckAccounts(directory, usernames, newPassword);

    expect(accounts()).toEqual([
      expect.objectContaining({ enabled: true, admin: true, password: passwords.admin }),
      expect.objectContaining({
        enabled: true,
        admin: false,
        casting: true,
        password: passwords.member,
      }),
      expect.objectContaining({
        enabled: true,
        admin: false,
        casting: false,
        readOnly: false,
        password: passwords.readOnly,
      }),
    ]);
  });
});
