import type { App } from "aws-cdk-lib";

type Env = Record<string, string | undefined>;

/** The budget alert's address, given at deploy time (`-c alertEmail=…`, or ALERT_EMAIL in
 *  the shell) so it's never committed (remote-data FR13). */
export function alertEmailFrom(app: App, env: Env = process.env): string {
  const email: unknown = app.node.tryGetContext("alertEmail") ?? env.ALERT_EMAIL;
  // A sanity check, not full validation: one @, a dotted domain, and no longer than an
  // address can be (254 characters). The value is never echoed, in case it's mistyped.
  const plausible =
    typeof email === "string" && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
  if (!plausible) {
    throw new Error(
      "Give the budget alert's email address: ALERT_EMAIL=you@example.com pnpm infra:deploy",
    );
  }
  return email;
}
