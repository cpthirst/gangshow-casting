import { AccountList, accountRouteKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aTeamDirectory } from "./account.fixture.ts";
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

    const res = await api(
      signedIn("POST", "[]", JSON.stringify({ username: "jo", access: ["casting"] })),
    );

    expect(res.statusCode).toBe(403);
    expect(accounts()).toEqual([]);
  });

  it("let an admin create an account, which the list then shows", async () => {
    const { api } = setUp();

    const created = await api(
      signedIn("POST", "[admin]", JSON.stringify({ username: "jo", access: ["casting"] })),
    );
    const listed = await api(signedIn("GET", "[admin]"));

    expect(created.statusCode).toBe(201);
    expect(AccountList.parse(JSON.parse(listed.body ?? "")).accounts).toEqual([
      { username: "jo", access: ["casting"], enabled: true },
    ]);
  });
});

describe("changing an account through the account routes", () => {
  // Signed in as `username`, in `groups`, as API Gateway's JWT authorizer passes them on.
  const request = (
    method: string,
    rawPath: string,
    username: string,
    groups: string,
    body: unknown,
  ) => ({
    rawPath,
    requestContext: {
      http: { method },
      authorizer: { jwt: { claims: { username, "cognito:groups": groups } } },
    },
    body: JSON.stringify(body),
  });
  const setUp = () => {
    const { directory, accounts } = aTeamDirectory();
    return { api: lambdaEntry(createAccountRoutes(directory, () => "Made-up-temp-1")), accounts };
  };

  it("refuses a non-admin's reset, disable or enable with 403, changing nothing", async () => {
    const { api, accounts } = setUp();
    const before = accounts();

    for (const [method, path, body] of [
      ["POST", "/api/accounts/pat/password", {}],
      ["PUT", "/api/accounts/pat/enabled", { enabled: false }],
      ["PUT", "/api/accounts/pat/enabled", { enabled: true }],
    ] as const) {
      expect((await api(request(method, path, "sam", "[]", body))).statusCode).toBe(403);
    }
    expect(accounts()).toEqual(before);
  });

  it("knows who the signed-in admin is, so they can't disable themselves", async () => {
    const { api, accounts } = setUp();

    const res = await api(
      request("PUT", "/api/accounts/pat/enabled", "pat", "[admin]", { enabled: false }),
    );

    expect(res.statusCode).toBe(409);
    expect(accounts().find((account) => account.username === "pat")?.enabled).toBe(true);
  });

  it("refuses a non-admin changing anyone's access, themselves included, with 403", async () => {
    const { api, accounts } = setUp();
    const before = accounts();

    for (const target of ["sam", "pat"]) {
      const res = await api(
        request("PUT", `/api/accounts/${target}/access`, "sam", "[casting]", { access: "admin" }),
      );

      expect(res.statusCode).toBe(403);
    }
    expect(accounts()).toEqual(before);
  });

  it("won't let the only admin change their own access or disable themselves", async () => {
    const { api, accounts } = setUp();

    const demote = await api(
      request("PUT", "/api/accounts/pat/access", "pat", "[admin]", { access: ["casting"] }),
    );
    const disable = await api(
      request("PUT", "/api/accounts/pat/enabled", "pat", "[admin]", { enabled: false }),
    );

    expect([demote.statusCode, disable.statusCode]).toEqual([409, 409]);
    expect(accounts().find((account) => account.username === "pat")).toMatchObject({
      admin: true,
      enabled: true,
    });
  });

  it("lets an admin disable someone else", async () => {
    const { api, accounts } = setUp();

    const res = await api(
      request("PUT", "/api/accounts/sam/enabled", "pat", "[admin]", { enabled: false }),
    );

    expect(res.statusCode).toBe(200);
    expect(accounts().find((account) => account.username === "sam")?.enabled).toBe(false);
  });
});
