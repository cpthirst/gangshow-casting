import { AccountSummary } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anAccount, asCaller } from "./account.fixture.ts";
import { createSetAccess } from "./set-access.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up accounts: alex and kit are admins, sam has Casting, kim Stage and Tech, and jo nothing.
function setUp(
  seed = [
    anAccount("alex", { admin: true }),
    anAccount("kit", { admin: true }),
    anAccount("sam", { casting: true }),
    anAccount("kim", { stage: true, tech: true }),
    anAccount("jo"),
  ],
) {
  const { directory, accounts } = memoryUserDirectory(seed);
  const find = (username: string) => accounts().find((account) => account.username === username);
  return { directory, accounts, find, setAccess: createSetAccess(directory) };
}

describe("set access handler", () => {
  it("adds Casting to Stage and Tech, returning the account with its new access", async () => {
    const { setAccess, directory } = setUp();

    const res = await setAccess(asCaller("alex", "kim", { access: ["casting", "stage", "tech"] }));

    expect(res.statusCode).toBe(200);
    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "kim",
      access: ["casting", "stage", "tech"],
      enabled: true,
    });
    expect((await directory.find("kim"))?.access).toEqual(["casting", "stage", "tech"]);
  });

  it("makes an account read-only when every permission is taken away", async () => {
    const { setAccess, directory } = setUp();

    expect((await setAccess(asCaller("alex", "sam", { access: [] }))).statusCode).toBe(200);
    expect((await directory.find("sam"))?.access).toEqual([]);
  });

  it("makes an account an Admin, and later gives it permissions instead", async () => {
    const { setAccess, directory } = setUp();

    expect((await setAccess(asCaller("alex", "sam", { access: "admin" }))).statusCode).toBe(200);
    expect((await directory.find("sam"))?.access).toBe("admin");
    const res = await setAccess(asCaller("alex", "sam", { access: ["casting", "stage"] }));
    expect(res.statusCode).toBe(200);
    expect((await directory.find("sam"))?.access).toEqual(["casting", "stage"]);
  });

  it("signs the account out everywhere, so the new access takes effect at their next sign-in", async () => {
    const { setAccess, find } = setUp();

    await setAccess(asCaller("alex", "kim", { access: ["casting", "stage", "tech"] }));

    expect(find("kim")?.signedOutEverywhere).toBe(1);
  });

  it.each([
    ["alex", "alex"],
    ["alex", "ALEX"],
  ])("won't let %s change their own access (%s), with 409", async (caller, target) => {
    const { setAccess, accounts } = setUp();
    const before = accounts();

    const res = await setAccess(asCaller(caller, target, { access: ["casting"] }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "You can't change your own access." });
    expect(accounts()).toEqual(before);
  });

  it.each([[[]], [["casting", "stage"]]])(
    "keeps the only enabled admin an admin when given %j, with 409",
    async (access) => {
      const { setAccess, accounts, directory } = setUp([
        anAccount("alex", { admin: true }),
        // A disabled admin's sign-in lasts until it lapses, so it could still ask.
        anAccount("kit", { admin: true, enabled: false }),
      ]);
      const before = accounts();

      const res = await setAccess(asCaller("kit", "alex", { access }));

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body ?? "")).toEqual({
        message: "alex is the only enabled admin, so they stay an admin.",
      });
      expect(accounts()).toEqual(before);
      expect((await directory.find("alex"))?.access).toBe("admin");
    },
  );

  it("lets one admin change another's access while an enabled admin remains", async () => {
    const { setAccess, directory } = setUp();

    expect((await setAccess(asCaller("alex", "kit", { access: ["stage"] }))).statusCode).toBe(200);
    expect((await directory.find("kit"))?.access).toEqual(["stage"]);
  });

  it("refuses a change with 403 when the sign-in doesn't say who's asking", async () => {
    const { setAccess, accounts } = setUp();
    const before = accounts();
    const noUsername = {
      ...asCaller("alex", "sam", { access: "admin" }),
      requestContext: { authorizer: { jwt: { claims: { sub: "made-up" } } } },
    };

    expect((await setAccess(noUsername)).statusCode).toBe(403);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no such account", "nobody"],
    ["a name no account could have", "no body"],
  ])("returns 404 for %s, changing nothing", async (_case, username) => {
    const { setAccess, accounts } = setUp();
    const before = accounts();

    expect((await setAccess(asCaller("alex", username, { access: "admin" }))).statusCode).toBe(404);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no body", undefined],
    ["an unknown permission", { access: ["props"] }],
    ["the old role", { role: "casting" }],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { setAccess, accounts } = setUp();
    const before = accounts();

    expect((await setAccess(asCaller("alex", "sam", body))).statusCode).toBe(400);
    expect(accounts()).toEqual(before);
  });

  it("leaves a disabled account disabled when changing its access", async () => {
    const { setAccess } = setUp([
      anAccount("alex", { admin: true }),
      anAccount("lee", { enabled: false }),
    ]);

    const res = await setAccess(asCaller("alex", "lee", { access: "admin" }));

    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "lee",
      access: "admin",
      enabled: false,
    });
  });
});
