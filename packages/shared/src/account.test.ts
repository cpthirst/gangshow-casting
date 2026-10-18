import { describe, expect, it } from "vitest";
import {
  AccountList,
  CreatedAccount,
  NewAccount,
  SetAdmin,
  SetEnabled,
  Username,
} from "./account.ts";

describe("Username", () => {
  it("accepts 1 to 32 letters, digits, dots, hyphens or underscores", () => {
    for (const name of ["p", "pat", "Pat.Smith", "pat-2027", "pat_s", "a".repeat(32)]) {
      expect(Username.safeParse(name).success).toBe(true);
    }
  });

  it("refuses anything else, saying what a username may be", () => {
    for (const name of ["", "pat smith", "pat@example.com", "patrón", "a".repeat(33)]) {
      const result = Username.safeParse(name);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "A username is 1–32 letters, digits, dots, hyphens or underscores.",
      );
    }
  });
});

describe("NewAccount", () => {
  it("takes just a valid username", () => {
    expect(NewAccount.parse({ username: "jo" })).toEqual({ username: "jo" });
    expect(NewAccount.safeParse({ username: "jo smith" }).success).toBe(false);
  });

  it("refuses anything else, such as an email address or a password", () => {
    expect(NewAccount.safeParse({ username: "jo", email: "jo@example.com" }).success).toBe(false);
    expect(NewAccount.safeParse({ username: "jo", password: "chosen" }).success).toBe(false);
  });
});

describe("AccountList", () => {
  it("holds each account's username and whether it's an admin and enabled, nothing more", () => {
    const list = { accounts: [{ username: "pat", admin: true, enabled: true }] };

    expect(AccountList.parse(list)).toEqual(list);
    expect(
      AccountList.safeParse({ accounts: [{ ...list.accounts[0], email: "pat@example.com" }] })
        .success,
    ).toBe(false);
  });
});

describe("CreatedAccount", () => {
  it("holds the new account and its temporary password", () => {
    const created = {
      account: { username: "jo", admin: false, enabled: true },
      temporaryPassword: "Made-up-temp-1",
    };

    expect(CreatedAccount.parse(created)).toEqual(created);
  });
});

describe("SetEnabled", () => {
  it("takes whether the account is enabled, and nothing else", () => {
    expect(SetEnabled.parse({ enabled: false })).toEqual({ enabled: false });
    expect(SetEnabled.safeParse({ enabled: "no" }).success).toBe(false);
    expect(SetEnabled.safeParse({ enabled: true, admin: true }).success).toBe(false);
  });
});

describe("SetAdmin", () => {
  it("takes whether the account is an admin, and nothing else", () => {
    expect(SetAdmin.parse({ admin: true })).toEqual({ admin: true });
    expect(SetAdmin.safeParse({ admin: "yes" }).success).toBe(false);
    expect(SetAdmin.safeParse({ admin: true, enabled: false }).success).toBe(false);
  });
});
