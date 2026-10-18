import { describe, expect, it } from "vitest";
import { callerIs } from "./caller.ts";

const withClaims = (claims: Record<string, unknown>) => ({
  requestContext: { authorizer: { jwt: { claims } } },
});

describe("callerIs", () => {
  it("is self when the access token's username claim names the account, in any case", () => {
    expect(callerIs(withClaims({ username: "pat" }), "pat")).toBe("self");
    expect(callerIs(withClaims({ username: "PAT" }), "pat")).toBe("self");
  });

  it("is other when the token names someone else", () => {
    expect(callerIs(withClaims({ username: "pat" }), "sam")).toBe("other");
  });

  it("is unidentified for a signed-in request without a username, so the API refuses rather than guess", () => {
    expect(callerIs(withClaims({ sub: "made-up" }), "pat")).toBe("unidentified");
    expect(callerIs(withClaims({ "cognito:username": "pat" }), "pat")).toBe("unidentified");
    expect(callerIs(withClaims({ username: ["pat"] }), "pat")).toBe("unidentified");
  });

  it("is other on the dev server, which has no sign-in and acts for no account (ADR 0018)", () => {
    expect(callerIs({}, "pat")).toBe("other");
  });
});
