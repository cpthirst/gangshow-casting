import { AccountSummary } from "@app/shared";
import { describe, expect, it } from "vitest";
import { asCaller, aTeamDirectory } from "./account.fixture.ts";
import { createSetEnabled } from "./set-enabled.ts";

function setUp() {
  const { directory, accounts } = aTeamDirectory();
  return { directory, accounts, setEnabled: createSetEnabled(directory) };
}
const find = (accounts: ReturnType<typeof setUp>["accounts"], username: string) =>
  accounts().find((account) => account.username === username);

describe("set enabled handler", () => {
  it("disables an account, returning it as disabled", async () => {
    const { setEnabled, accounts } = setUp();

    const res = await setEnabled(asCaller("pat", "sam", { enabled: false }));

    expect(res.statusCode).toBe(200);
    expect(AccountSummary.parse(JSON.parse(res.body ?? ""))).toEqual({
      username: "sam",
      admin: false,
      enabled: false,
    });
    expect(find(accounts, "sam")?.enabled).toBe(false);
  });

  it("signs a disabled account out on every device", async () => {
    const { setEnabled, accounts } = setUp();

    await setEnabled(asCaller("pat", "sam", { enabled: false }));

    expect(find(accounts, "sam")?.signedOutEverywhere).toBe(1);
  });

  it("enables an account again, keeping its own password", async () => {
    const { setEnabled, directory, accounts } = setUp();
    await directory.setEnabled("sam", false);

    const res = await setEnabled(asCaller("pat", "sam", { enabled: true }));

    expect(res.statusCode).toBe(200);
    expect(find(accounts, "sam")).toMatchObject({
      enabled: true,
      password: "Made-up-own-1",
      passwordKind: "permanent",
    });
  });

  it.each([
    ["pat", "pat"],
    ["pat", "PAT"],
  ])("won't let %s disable their own account (%s), keeping it enabled", async (caller, target) => {
    const { setEnabled, accounts } = setUp();

    const res = await setEnabled(asCaller(caller, target, { enabled: false }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "You can't disable your own account." });
    expect(find(accounts, "pat")).toMatchObject({ enabled: true, signedOutEverywhere: 0 });
  });

  it("refuses to disable anyone with 403 when the sign-in doesn't say who's asking", async () => {
    const { setEnabled, accounts } = setUp();
    const before = accounts();
    const noUsername = {
      ...asCaller("pat", "sam", { enabled: false }),
      requestContext: { authorizer: { jwt: { claims: { sub: "made-up" } } } },
    };

    expect((await setEnabled(noUsername)).statusCode).toBe(403);
    expect(accounts()).toEqual(before);
  });

  it("lets the dev server, which has no sign-in, disable an account", async () => {
    const { setEnabled, accounts } = setUp();

    const res = await setEnabled({
      pathParameters: { username: "sam" },
      body: '{"enabled":false}',
    });

    expect(res.statusCode).toBe(200);
    expect(find(accounts, "sam")?.enabled).toBe(false);
  });

  it.each([
    ["no such account", "nobody"],
    ["a name no account could have", "no body"],
  ])("returns 404 for %s, changing nothing", async (_case, username) => {
    const { setEnabled, accounts } = setUp();
    const before = accounts();

    const res = await setEnabled(asCaller("pat", username, { enabled: false }));

    expect(res.statusCode).toBe(404);
    expect(accounts()).toEqual(before);
  });

  it.each([
    ["no body", undefined],
    ["a value that isn't true or false", { enabled: "no" }],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { setEnabled, accounts } = setUp();
    const before = accounts();

    const res = await setEnabled(asCaller("pat", "sam", body));

    expect(res.statusCode).toBe(400);
    expect(accounts()).toEqual(before);
  });
});
