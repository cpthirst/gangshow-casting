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
  it.each([
    ["Admin", "admin"],
    ["Stage and Tech", ["stage", "tech"]],
    ["every permission", ["casting", "stage", "tech", "costume"]],
    ["no permissions, read-only", []],
  ] as const)("creates an enabled account with %s, and only that", async (_case, chosen) => {
    const { handler, directory } = setUp();
    const access = chosen === "admin" ? chosen : [...chosen];

    const res = await handler(request({ username: "pat", access }));

    expect(res.statusCode).toBe(201);
    expect(CreatedAccount.parse(JSON.parse(res.body ?? "")).account).toEqual({
      username: "pat",
      access,
      enabled: true,
    });
    expect(await directory.list()).toEqual([{ username: "pat", access, enabled: true }]);
  });

  it("creates pat with Stage, in the stage group alone, to choose a password at first sign-in", async () => {
    const { handler, accounts } = setUp();

    await handler(request({ username: "pat", access: ["stage"] }));

    // The groups pat's sign-in will carry, which the API checks every change against.
    expect(accounts()).toEqual([
      expect.objectContaining({
        username: "pat",
        admin: false,
        casting: false,
        stage: true,
        tech: false,
        costume: false,
        passwordKind: "temporary",
      }),
    ]);
  });

  it("creates a read-only account and returns its temporary password once", async () => {
    const { handler, accounts } = setUp();

    const res = await handler(request({ username: "jo", access: [] }));

    expect(res.statusCode).toBe(201);
    expect(CreatedAccount.parse(JSON.parse(res.body ?? ""))).toEqual({
      account: { username: "jo", access: [], enabled: true },
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
    await directory.create("sam", "Made-up-1", ["casting"]);

    const res = await handler(request({ username: "Sam", access: ["casting"] }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "That username is already taken." });
    expect(accounts().map((account) => account.username)).toEqual(["sam"]);
  });

  it.each([
    ["an empty username", { username: "", access: ["casting"] }],
    ["a username with spaces", { username: "jo smith", access: ["casting"] }],
    ["a username over 32 characters", { username: "j".repeat(33), access: ["casting"] }],
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
    ["a chosen password", { username: "jo", access: [], password: "Chosen-1" }],
    ["no access", { username: "jo" }],
    ["a permission that doesn't exist", { username: "jo", access: ["stage", "props"] }],
    ["access that isn't Admin or a list", { username: "jo", access: "superadmin" }],
    ["a permission listed twice", { username: "jo", access: ["stage", "stage"] }],
    ["the old role", { username: "jo", role: "casting" }],
  ])("refuses %s with 400, creating nothing", async (_case, body) => {
    const { handler, accounts } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect(accounts()).toEqual([]);
  });
});
