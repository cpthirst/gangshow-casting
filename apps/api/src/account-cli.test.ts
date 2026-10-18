import { describe, expect, it } from "vitest";
import { anAccount } from "./account.fixture.ts";
import { runAccount } from "./account-cli.ts";
import { memoryUserDirectory } from "./user-directory.ts";

const POOL = "eu-west-2_madeup";
const USAGE = [
  "Usage:",
  "  pnpm account admin <username>                            create or restore an admin",
  "  pnpm account check <admin username> <member username>    set up the post-deploy check's accounts",
  "  pnpm account roles                                       make every account in no role a Casting Team Member",
];

const run = async (args: string[], env = { USER_POOL_ID: POOL }, seed = memoryUserDirectory()) => {
  const lines: string[] = [];
  const pools: string[] = [];
  let generated = 0;
  const code = await runAccount(args, env, {
    print: (line) => lines.push(line),
    directoryFor: (poolId) => {
      pools.push(poolId);
      return seed.directory;
    },
    newPassword: () => `Made-up-password-${++generated}`,
  });
  return { code, lines, pools, accounts: seed.accounts() };
};

const timesShown = (lines: string[], text: string) => lines.join("\n").split(text).length - 1;

describe("the account script", () => {
  it("creates the first admin and prints its temporary password once", async () => {
    const { code, lines, pools, accounts } = await run(["admin", "pat"]);

    expect(code).toBe(0);
    expect(pools).toEqual([POOL]);
    expect(accounts).toEqual([
      expect.objectContaining({ username: "pat", admin: true, passwordKind: "temporary" }),
    ]);
    expect(lines).toEqual([
      `Using user pool ${POOL}.`,
      "Created pat as an admin.",
      "Temporary password, shown only now: Made-up-password-1",
      "pat must choose a new password at first sign-in.",
    ]);
  });

  it("restores an existing admin, saying it was reset and signed out everywhere", async () => {
    const existing = memoryUserDirectory([
      {
        username: "pat",
        enabled: false,
        admin: false,
        casting: false,
        readOnly: false,
        password: "Old-password-9",
        passwordKind: "permanent",
        signedOutEverywhere: 0,
      },
    ]);

    const { code, lines } = await run(["admin", "pat"], { USER_POOL_ID: POOL }, existing);

    expect(code).toBe(0);
    expect(lines).toContain(
      "Restored pat: enabled, an admin, and signed out on every device within the hour.",
    );
    expect(timesShown(lines, "Made-up-password-1")).toBe(1);
  });

  it("explains how to give a username, and changes nothing, when none is given", async () => {
    for (const args of [
      [],
      ["admin"],
      ["check", "check-admin"],
      ["remove", "pat"],
      ["roles", "sam"],
    ]) {
      const { code, lines, pools } = await run(args);

      expect(code).toBe(1);
      expect(lines).toEqual(USAGE);
      expect(pools).toEqual([]);
    }
  });

  it("says what a username may be, and changes nothing, when one isn't valid", async () => {
    for (const args of [
      ["admin", "pat smith"],
      ["check", "check admin", "check-member"],
      ["check", "check-admin", "check member"],
    ]) {
      const { code, lines, pools } = await run(args);

      expect(code).toBe(1);
      expect(lines).toEqual(["A username is 1–32 letters, digits, dots, hyphens or underscores."]);
      expect(pools).toEqual([]);
    }
  });

  it("refuses the same username for both check accounts", async () => {
    const { code, lines, pools } = await run(["check", "check-admin", "check-admin"]);

    expect(code).toBe(1);
    expect(lines).toEqual(["The two check accounts need different usernames."]);
    expect(pools).toEqual([]);
  });

  it("asks for the user pool when USER_POOL_ID isn't set", async () => {
    const { code, lines, pools } = await run(["admin", "pat"], { USER_POOL_ID: "" });

    expect(code).toBe(1);
    expect(lines).toEqual([
      "Set USER_POOL_ID to the user pool's id (the stack's UserPoolId output).",
    ]);
    expect(pools).toEqual([]);
  });

  it("sets up the check accounts and prints each permanent password once", async () => {
    const { code, lines, accounts } = await run(["check", "check-admin", "check-member"]);

    expect(code).toBe(0);
    expect(accounts).toEqual([
      expect.objectContaining({ username: "check-admin", admin: true, passwordKind: "permanent" }),
      expect.objectContaining({
        username: "check-member",
        admin: false,
        passwordKind: "permanent",
      }),
    ]);
    expect(lines).toEqual([
      `Using user pool ${POOL}.`,
      "check-admin is an admin and check-member isn't, both with permanent passwords.",
      "Passwords, shown only now, for pnpm check:hosted:",
      "  check-admin: Made-up-password-1",
      "  check-member: Made-up-password-2",
    ]);
  });

  it("names only the kind of error when the user pool refuses a change", async () => {
    const failing = memoryUserDirectory();
    failing.directory.find = async () => {
      throw Object.assign(new Error("pat: details from AWS"), { name: "NotAuthorizedException" });
    };

    const { code, lines } = await run(["admin", "pat"], { USER_POOL_ID: POOL }, failing);

    expect(code).toBe(1);
    expect(lines.at(-1)).toBe(
      "Couldn't change the accounts (NotAuthorizedException). Check your AWS profile and USER_POOL_ID, then run it again.",
    );
    expect(lines.join("\n")).not.toContain("details from AWS");
  });

  it("doesn't show a password that a failed run never finished setting up", async () => {
    const failing = memoryUserDirectory();
    failing.directory.create = async () => {
      throw Object.assign(new Error("denied"), { name: "AccessDeniedException" });
    };

    const { code, lines } = await run(["admin", "pat"], { USER_POOL_ID: POOL }, failing);

    expect(code).toBe(1);
    expect(lines.join("\n")).not.toContain("Made-up-password");
  });

  it("makes every account in no role a Casting Team Member, saying how many it checked and moved", async () => {
    const existing = memoryUserDirectory([
      anAccount("pat", { admin: true }),
      anAccount("sam"),
      anAccount("kit"),
      anAccount("lee", { casting: true }),
    ]);

    const { code, lines, accounts } = await run(["roles"], { USER_POOL_ID: POOL }, existing);

    expect(code).toBe(0);
    expect(lines).toEqual([
      `Using user pool ${POOL}.`,
      "Checked 4 accounts. Made 2 Casting Team Members: sam, kit.",
      "They can change casting again once their sign-in renews, within the hour.",
    ]);
    expect(accounts.filter((account) => !account.admin && !account.casting)).toEqual([]);
    expect(accounts.find((account) => account.username === "pat")).toMatchObject({
      admin: true,
      casting: false,
    });
  });

  it("changes nothing when run again", async () => {
    const existing = memoryUserDirectory([anAccount("pat", { admin: true }), anAccount("sam")]);
    await run(["roles"], { USER_POOL_ID: POOL }, existing);
    const before = existing.accounts();

    const { code, lines, accounts } = await run(["roles"], { USER_POOL_ID: POOL }, existing);

    expect(code).toBe(0);
    expect(lines).toEqual([
      `Using user pool ${POOL}.`,
      "Checked 2 accounts. Every one already has a role.",
    ]);
    expect(accounts).toEqual(before);
  });
});
