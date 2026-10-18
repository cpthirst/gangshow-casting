import { AccountList, accountRouteKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createAccountRoutes } from "./account-routes.ts";
import { lambdaEntry } from "./lambda-entry.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// A signed-in request, with the token's groups as API Gateway's JWT authorizer passes them on.
const signedIn = (method: string, groups: string, body?: string) => ({
  rawPath: "/api/accounts",
  requestContext: {
    http: { method },
    authorizer: { jwt: { claims: { sub: "made-up", "cognito:groups": groups } } },
  },
  ...(body === undefined ? {} : { body }),
});

function setUp() {
  const { directory, accounts } = memoryUserDirectory();
  const api = lambdaEntry(createAccountRoutes(directory, () => "Made-up-temp-1"));
  return { api, accounts };
}

describe("the account routes", () => {
  it("have a handler for exactly the shared list's account routes", () => {
    const { directory } = memoryUserDirectory();

    expect(Object.keys(createAccountRoutes(directory)).sort()).toEqual(
      [...accountRouteKeys].sort(),
    );
  });

  it("refuse a non-admin's request for the accounts list with 403", async () => {
    const { api } = setUp();

    const res = await api(signedIn("GET", "[crew]"));

    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain("accounts");
  });

  it("refuse a non-admin's new account with 403, creating nothing", async () => {
    const { api, accounts } = setUp();

    const res = await api(signedIn("POST", "[]", JSON.stringify({ username: "jo" })));

    expect(res.statusCode).toBe(403);
    expect(accounts()).toEqual([]);
  });

  it("let an admin create an account, which the list then shows", async () => {
    const { api } = setUp();

    const created = await api(signedIn("POST", "[admin]", JSON.stringify({ username: "jo" })));
    const listed = await api(signedIn("GET", "[admin]"));

    expect(created.statusCode).toBe(201);
    expect(AccountList.parse(JSON.parse(listed.body ?? "")).accounts).toEqual([
      { username: "jo", admin: false, enabled: true },
    ]);
  });
});
