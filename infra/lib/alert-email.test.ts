import { App } from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { alertEmailFrom } from "./alert-email.ts";

const appWith = (context: Record<string, unknown>) => new App({ context });

describe("alertEmailFrom", () => {
  it("takes the budget alert's address from the deploy command's context", () => {
    expect(alertEmailFrom(appWith({ alertEmail: "alerts@example.com" }))).toBe(
      "alerts@example.com",
    );
  });

  it.each([
    ["no address", {}],
    ["something that isn't an email address", { alertEmail: "nobody" }],
    ["an address with no proper domain", { alertEmail: "someone@example" }],
    ["an address with a space", { alertEmail: "some one@example.com" }],
    ["an address too long to be real", { alertEmail: `${"x".repeat(250)}@example.com` }],
  ])("stops with how to supply one when given %s", (_case, context) => {
    expect(() => alertEmailFrom(appWith(context))).toThrow(
      "Give the budget alert's email address: cdk deploy -c alertEmail=you@example.com",
    );
  });
});
