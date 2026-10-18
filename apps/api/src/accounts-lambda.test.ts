import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const POOL = "eu-west-2_madeup";
const cognito = mockClient(CognitoIdentityProviderClient);
const listAccounts = (groups: string) => ({
  rawPath: "/api/accounts",
  requestContext: {
    http: { method: "GET" },
    authorizer: { jwt: { claims: { sub: "made-up", "cognito:groups": groups } } },
  },
});

beforeEach(() => {
  cognito.reset();
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe("the accounts function's entry point", () => {
  it("lists the accounts in the user pool USER_POOL_ID names, for an admin", async () => {
    vi.stubEnv("USER_POOL_ID", POOL);
    cognito.on(ListUsersCommand).resolves({ Users: [{ Username: "pat", Enabled: true }] });
    cognito.on(ListUsersInGroupCommand).resolves({ Users: [{ Username: "pat" }] });
    const { handler } = await import("./accounts-lambda.ts");

    const res = await handler(listAccounts("[admin]"));

    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "cache-control": "no-store" });
    expect(cognito.commandCalls(ListUsersCommand)[0]?.args[0].input).toEqual({ UserPoolId: POOL });
  });

  it("refuses a non-admin without asking the user pool", async () => {
    vi.stubEnv("USER_POOL_ID", POOL);
    const { handler } = await import("./accounts-lambda.ts");

    expect((await handler(listAccounts("[crew]"))).statusCode).toBe(403);
    expect(cognito.calls()).toEqual([]);
  });

  it("tells an admin a username the pool already has is taken", async () => {
    vi.stubEnv("USER_POOL_ID", POOL);
    cognito
      .on(AdminCreateUserCommand)
      .rejects(new UsernameExistsException({ message: "User already exists", $metadata: {} }));
    const { handler } = await import("./accounts-lambda.ts");

    const res = await handler({
      ...listAccounts("[admin]"),
      requestContext: { ...listAccounts("[admin]").requestContext, http: { method: "POST" } },
      body: JSON.stringify({ username: "Sam" }),
    });

    expect(res.statusCode).toBe(409);
    expect(cognito.commandCalls(AdminCreateUserCommand)[0]?.args[0].input).toMatchObject({
      UserPoolId: POOL,
      Username: "Sam",
    });
  });

  it("won't start without USER_POOL_ID", async () => {
    vi.stubEnv("USER_POOL_ID", "");

    await expect(import("./accounts-lambda.ts")).rejects.toThrow("USER_POOL_ID");
  });
});
