import { CreatedAccount } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createCreateAccount } from "./create-account.ts";
import { memoryUserDirectory } from "./user-directory.ts";

const request = (body: unknown) => ({
  body: typeof body === "string" ? body : JSON.stringify(body),
});

// Made-up usernames only (CLAUDE.md safeguarding).
function setUp() {
  const { directory, accounts } = memoryUserDirectory();
  const handler = createCreateAccount(directory, () => "Made-up-temp-1");
  return { directory, accounts, handler };
}

describe("create account handler", () => {
  it.each(["admin", "casting", "read-only"] as const)(
    "creates an enabled account in the %s role, in no other",
    async (role) => {
      const { handler, directory } = setUp();

      const res = await handler(request({ username: "jo", role }));

      expect(res.statusCode).toBe(201);
      expect(await directory.list()).toEqual([{ username: "jo", role, enabled: true }]);
    },
  );

  it("creates a Read-Only Team Member and returns its temporary password once", async () => {
    const { handler, accounts } = setUp();

    const res = await handler(request({ username: "jo", role: "read-only" }));

    expect(res.statusCode).toBe(201);
    expect(CreatedAccount.parse(JSON.parse(res.body ?? ""))).toEqual({
      account: { username: "jo", role: "read-only", enabled: true },
      temporaryPassword: "Made-up-temp-1",
    });
    // A temporary password: Jo must choose a new one at first sign-in.
    expect(accounts()).toEqual([
      expect.objectContaining({
        username: "jo",
        password: "Made-up-temp-1",
        passwordKind: "temporary",
      }),
    ]);
  });

  it("refuses a username that's taken in any case with 409, creating nothing", async () => {
    const { handler, directory, accounts } = setUp();
    await directory.create("sam", "Made-up-1", "casting");

    const res = await handler(request({ username: "Sam", role: "casting" }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "That username is already taken." });
    expect(accounts().map((account) => account.username)).toEqual(["sam"]);
  });

  it.each([
    ["an empty username", { username: "", role: "casting" }],
    ["a username with spaces", { username: "jo smith", role: "casting" }],
    ["a username over 32 characters", { username: "j".repeat(33), role: "casting" }],
  ])("refuses %s with 400, saying what a username may be", async (_case, body) => {
    const { handler, accounts } = setUp();

    const res = await handler(request(body));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "A username is 1–32 letters, digits, dots, hyphens or underscores.",
    });
    expect(accounts()).toEqual([]);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a chosen password", { username: "jo", role: "casting", password: "Chosen-1" }],
    ["no role", { username: "jo" }],
    ["a role that isn't one of the three", { username: "jo", role: "superadmin" }],
  ])("refuses %s with 400, creating nothing", async (_case, body) => {
    const { handler, accounts } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect(accounts()).toEqual([]);
  });
});
