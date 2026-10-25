import { describe, expect, it } from "vitest";
import {
  AccountList,
  CreatedAccount,
  NewAccount,
  SetAccess,
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
  it("takes a valid username and one of the three roles", () => {
    expect(NewAccount.parse({ username: "jo", role: "read-only" })).toEqual({
      username: "jo",
      role: "read-only",
    });
    expect(NewAccount.safeParse({ username: "jo smith", role: "casting" }).success).toBe(false);
  });

  it("refuses a missing or unknown role", () => {
    expect(NewAccount.safeParse({ username: "jo" }).success).toBe(false);
    expect(NewAccount.safeParse({ username: "jo", role: "member" }).success).toBe(false);
  });

  it("refuses anything else, such as an email address or a password", () => {
    const jo = { username: "jo", role: "casting" };
    expect(NewAccount.safeParse({ ...jo, email: "jo@example.com" }).success).toBe(false);
    expect(NewAccount.safeParse({ ...jo, password: "chosen" }).success).toBe(false);
  });
});

describe("AccountList", () => {
  it("holds each account's username, access and whether it's enabled, nothing more", () => {
    const list = {
      accounts: [
        { username: "pat", access: "admin", enabled: true },
        { username: "kim", access: ["stage", "tech"], enabled: true },
        { username: "jo", access: [], enabled: false },
      ],
    };

    expect(AccountList.parse(list)).toEqual(list);
    expect(
      AccountList.safeParse({ accounts: [{ ...list.accounts[0], email: "pat@example.com" }] })
        .success,
    ).toBe(false);
  });

  it.each([
    ["an unknown access", "superadmin"],
    ["an unknown permission", ["casting", "props"]],
    ["a permission twice", ["stage", "stage"]],
    ["the old role", undefined],
  ])("refuses %s", (_case, access) => {
    const account = {
      username: "pat",
      enabled: true,
      ...(access ? { access } : { role: "admin" }),
    };

    expect(AccountList.safeParse({ accounts: [account] }).success).toBe(false);
  });
});

describe("CreatedAccount", () => {
  it("holds the new account and its temporary password", () => {
    const created = {
      account: { username: "jo", access: ["casting"], enabled: true },
      temporaryPassword: "Made-up-temp-1",
    };

    expect(CreatedAccount.parse(created)).toEqual(created);
  });
});

describe("SetEnabled", () => {
  it("takes whether the account is enabled, and nothing else", () => {
    expect(SetEnabled.parse({ enabled: false })).toEqual({ enabled: false });
    expect(SetEnabled.safeParse({ enabled: "no" }).success).toBe(false);
    expect(SetEnabled.safeParse({ enabled: true, access: "admin" }).success).toBe(false);
  });
});

describe("SetAccess", () => {
  it.each([["admin"], [[]], [["casting"]], [["casting", "stage", "tech", "costume"]]])(
    "takes the access %j",
    (access) => {
      expect(SetAccess.parse({ access })).toEqual({ access });
    },
  );

  it("refuses an unknown access or permission, a repeated one, or anything else", () => {
    expect(SetAccess.safeParse({ access: "Admin" }).success).toBe(false);
    expect(SetAccess.safeParse({ access: "casting" }).success).toBe(false);
    expect(SetAccess.safeParse({ access: ["admin"] }).success).toBe(false);
    expect(SetAccess.safeParse({ access: ["tech", "tech"] }).success).toBe(false);
    expect(SetAccess.safeParse({ role: "admin" }).success).toBe(false);
    expect(SetAccess.safeParse({ access: [], enabled: false }).success).toBe(false);
  });
});
