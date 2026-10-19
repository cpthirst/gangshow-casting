import { AccountSummary } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anAccount, asCaller } from "./account.fixture.ts";
import { createSetRole } from "./set-role.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up accounts: pat and kit are admins, sam a Casting and jo a Read-Only Team Member.
function setUp(
  seed = [
    anAccount("pat", { admin: true }),
    anAccount("kit", { admin: true }),
    anAccount("sam", { casting: true }),
    anAccount("jo", { readOnly: true }),
  ],
) {
  const { directory, accounts } = memoryUserDirectory(seed);
  const find = (username: string) => accounts().find((account) => account.username === username);
  return { directory, accounts, find, setRole: createSetRole(directory) };
}

describe("set role handler", () => {
  it("makes a Casting Team Member read-only, returning the account in its new role", async () => {
    const { setRole, directory } = setUp();

    const res = await setRole(asCaller("pat", "sam", { role: "read-only" }));

    expect(res.statusCode).toBe(200);
    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "sam",
      role: "read-only",
      enabled: true,
    });
    expect((await directory.find("sam"))?.role).toBe("read-only");
  });

  it("can give every role: read-only to casting, then casting to admin", async () => {
    const { setRole, directory } = setUp();

    expect((await setRole(asCaller("pat", "jo", { role: "casting" }))).statusCode).toBe(200);
    expect((await directory.find("jo"))?.role).toBe("casting");
    expect((await setRole(asCaller("pat", "jo", { role: "admin" }))).statusCode).toBe(200);
    expect((await directory.find("jo"))?.role).toBe("admin");
  });

  it("signs the account out everywhere, so the new role takes effect at their next sign-in", async () => {
    const { setRole, find } = setUp();

    await setRole(asCaller("pat", "sam", { role: "admin" }));

    expect(find("sam")?.signedOutEverywhere).toBe(1);
  });

  it.each([
    ["pat", "pat"],
    ["pat", "PAT"],
  ])("won't let %s change their own role (%s), with 409", async (caller, target) => {
    const { setRole, accounts } = setUp();
    const before = accounts();

    const res = await setRole(asCaller(caller, target, { role: "casting" }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "You can't change your own role." });
    expect(accounts()).toEqual(before);
  });

  it("keeps the only enabled admin an admin, with 409", async () => {
    const { setRole, accounts } = setUp([
      anAccount("pat", { admin: true }),
      // A disabled admin's sign-in lasts until it lapses, so it could still ask.
      anAccount("kit", { admin: true, enabled: false }),
    ]);
    const before = accounts();

    const res = await setRole(asCaller("kit", "pat", { role: "read-only" }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "pat is the only enabled admin, so they stay an admin.",
    });
    expect(accounts()).toEqual(before);
  });

  it("lets one admin change another's role while an enabled admin remains", async () => {
    const { setRole, directory } = setUp();

    expect((await setRole(asCaller("pat", "kit", { role: "casting" }))).statusCode).toBe(200);
    expect((await directory.find("kit"))?.role).toBe("casting");
  });

  it("refuses a change with 403 when the sign-in doesn't say who's asking", async () => {
    const { setRole, accounts } = setUp();
    const before = accounts();
    const noUsername = {
      ...asCaller("pat", "sam", { role: "admin" }),
      requestContext: { authorizer: { jwt: { claims: { sub: "made-up" } } } },
    };

    expect((await setRole(noUsername)).statusCode).toBe(403);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no such account", "nobody"],
    ["a name no account could have", "no body"],
  ])("returns 404 for %s, changing nothing", async (_case, username) => {
    const { setRole, accounts } = setUp();
    const before = accounts();

    expect((await setRole(asCaller("pat", username, { role: "admin" }))).statusCode).toBe(404);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no body", undefined],
    ["a role that isn't one of the three", { role: "member" }],
    ["the old admin flag", { admin: true }],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { setRole, accounts } = setUp();
    const before = accounts();

    expect((await setRole(asCaller("pat", "sam", body))).statusCode).toBe(400);
    expect(accounts()).toEqual(before);
  });

  it("leaves a disabled account disabled when changing its role", async () => {
    const { setRole } = setUp([
      anAccount("pat", { admin: true }),
      anAccount("lee", { enabled: false }),
    ]);

    const res = await setRole(asCaller("pat", "lee", { role: "admin" }));

    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "lee",
      role: "admin",
      enabled: false,
    });
  });
});
