import { afterEach, describe, expect, it } from "vitest";
import { alertEmailFrom } from "./alert-email.ts";
import { newApp, removeSynthesisedApps } from "./synth-for-test.ts";

const appWith = newApp;
const HOW_TO =
  "Give the budget alert's email address: ALERT_EMAIL=you@example.com pnpm infra:deploy";

describe("alertEmailFrom", () => {
  afterEach(removeSynthesisedApps);

  it("takes the budget alert's address from the deploy command's context", () => {
    expect(alertEmailFrom(appWith({ alertEmail: "alerts@example.com" }), {})).toBe(
      "alerts@example.com",
    );
  });

  it("takes it from ALERT_EMAIL when the context doesn't give one", () => {
    expect(alertEmailFrom(appWith({}), { ALERT_EMAIL: "alerts@example.com" })).toBe(
      "alerts@example.com",
    );
  });

  it("prefers the context, so one deploy can override the shell's setting", () => {
    const app = appWith({ alertEmail: "other@example.com" });

    expect(alertEmailFrom(app, { ALERT_EMAIL: "alerts@example.com" })).toBe("other@example.com");
  });

  it.each([
    ["no address", {}, {}],
    ["an empty ALERT_EMAIL", {}, { ALERT_EMAIL: "" }],
    // Given on the command line, so it wins, even empty.
    ["an empty -c alertEmail", { alertEmail: "" }, { ALERT_EMAIL: "alerts@example.com" }],
    ["something that isn't an email address", { alertEmail: "nobody" }, {}],
    ["an address with no proper domain", {}, { ALERT_EMAIL: "someone@example" }],
    ["an address with a space", { alertEmail: "some one@example.com" }, {}],
    ["an address too long to be real", { alertEmail: `${"x".repeat(250)}@example.com` }, {}],
  ])("stops with how to supply one when given %s", (_case, context, env) => {
    expect(() => alertEmailFrom(appWith(context), env)).toThrow(HOW_TO);
  });
});
