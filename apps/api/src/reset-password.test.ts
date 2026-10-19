import { CreatedAccount } from "@app/shared";
import { describe, expect, it } from "vitest";
import { asCaller, aTeamDirectory } from "./account.fixture.ts";
import { createResetPassword } from "./reset-password.ts";

function setUp() {
  const { directory, accounts } = aTeamDirectory();
  return { accounts, reset: createResetPassword(directory, () => "Made-up-temp-2") };
}
const sam = (accounts: ReturnType<typeof setUp>["accounts"]) =>
  accounts().find((account) => account.username === "sam");

describe("reset password handler", () => {
  it("gives the account a temporary password, returned once, that it must change at next sign-in", async () => {
    const { reset, accounts } = setUp();

    const res = await reset(asCaller("pat", "sam"));

    expect(res.statusCode).toBe(200);
    expect(CreatedAccount.parse(JSON.parse(res.body ?? ""))).toEqual({
      account: { username: "sam", role: "casting", enabled: true },
      temporaryPassword: "Made-up-temp-2",
    });
    expect(sam(accounts)).toMatchObject({ password: "Made-up-temp-2", passwordKind: "temporary" });
  });

  it("signs the account out on every device", async () => {
    const { reset, accounts } = setUp();

    await reset(asCaller("pat", "sam"));

    expect(sam(accounts)?.signedOutEverywhere).toBe(1);
  });

  it.each([
    ["no such account", "nobody"],
    ["a name no account could have", "no body"],
  ])("returns 404 for %s, changing nothing", async (_case, username) => {
    const { reset, accounts } = setUp();
    const before = accounts();

    const res = await reset(asCaller("pat", username));

    expect(res.statusCode).toBe(404);
    expect(accounts()).toEqual(before);
  });
});
