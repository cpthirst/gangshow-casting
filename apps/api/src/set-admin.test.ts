import { AccountSummary } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anAccount, asCaller, aTeamDirectory } from "./account.fixture.ts";
import { createSetAdmin } from "./set-admin.ts";
import { memoryUserDirectory } from "./user-directory.ts";

function setUp() {
  const { directory, accounts } = aTeamDirectory();
  return { directory, accounts, setAdmin: createSetAdmin(directory) };
}
const find = (accounts: ReturnType<typeof setUp>["accounts"], username: string) =>
  accounts().find((account) => account.username === username);

describe("set admin handler", () => {
  it("makes an account an admin, returning it as one", async () => {
    const { setAdmin, accounts } = setUp();

    const res = await setAdmin(asCaller("pat", "sam", { admin: true }));

    expect(res.statusCode).toBe(200);
    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "sam",
      admin: true,
      enabled: true,
    });
    expect(find(accounts, "sam")?.admin).toBe(true);
  });

  it("signs a new admin out everywhere too, so either change takes effect at their next sign-in", async () => {
    const { setAdmin, accounts } = setUp();

    await setAdmin(asCaller("pat", "sam", { admin: true }));

    expect(find(accounts, "sam")?.signedOutEverywhere).toBe(1);
  });

  it("removes admin, signing the account out everywhere so it takes effect within the hour", async () => {
    const { setAdmin, directory, accounts } = setUp();
    await directory.setAdmin("sam", true);

    const res = await setAdmin(asCaller("pat", "sam", { admin: false }));

    expect(res.statusCode).toBe(200);
    expect(find(accounts, "sam")).toMatchObject({ admin: false, signedOutEverywhere: 1 });
  });

  it.each([
    ["pat", "pat"],
    ["pat", "PAT"],
  ])("won't let %s remove their own admin role (%s)", async (caller, target) => {
    const { setAdmin, accounts } = setUp();

    const res = await setAdmin(asCaller(caller, target, { admin: false }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "You can't remove your own admin role.",
    });
    expect(find(accounts, "pat")).toMatchObject({ admin: true, signedOutEverywhere: 0 });
  });

  it("refuses to remove anyone's admin with 403 when the sign-in doesn't say who's asking", async () => {
    const { setAdmin, directory, accounts } = setUp();
    await directory.setAdmin("sam", true);
    const before = accounts();
    const noUsername = {
      ...asCaller("pat", "sam", { admin: false }),
      requestContext: { authorizer: { jwt: { claims: { sub: "made-up" } } } },
    };

    expect((await setAdmin(noUsername)).statusCode).toBe(403);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no such account", "nobody"],
    ["a name no account could have", "no body"],
  ])("returns 404 for %s, changing nothing", async (_case, username) => {
    const { setAdmin, accounts } = setUp();
    const before = accounts();

    expect((await setAdmin(asCaller("pat", username, { admin: true }))).statusCode).toBe(404);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no body", undefined],
    ["a value that isn't true or false", { admin: "yes" }],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { setAdmin, accounts } = setUp();
    const before = accounts();

    expect((await setAdmin(asCaller("pat", "sam", body))).statusCode).toBe(400);
    expect(accounts()).toEqual(before);
  });

  it("leaves a disabled account disabled when making it an admin", async () => {
    const { directory } = memoryUserDirectory([
      anAccount("pat", { admin: true }),
      anAccount("lee", { enabled: false }),
    ]);

    const res = await createSetAdmin(directory)(asCaller("pat", "lee", { admin: true }));

    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "lee",
      admin: true,
      enabled: false,
    });
  });
});
