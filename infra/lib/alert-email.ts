import type { App } from "aws-cdk-lib";

/** The budget alert's address, given at deploy time (`-c alertEmail=…`) so it's never
 *  committed (remote-data FR13). */
export function alertEmailFrom(app: App): string {
  const email: unknown = app.node.tryGetContext("alertEmail");
  // A sanity check, not full validation: one @, a dotted domain, and no longer than an
  // address can be (254 characters). The value is never echoed, in case it's mistyped.
  const plausible =
    typeof email === "string" && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
  if (!plausible) {
    throw new Error(
      "Give the budget alert's email address: cdk deploy -c alertEmail=you@example.com",
    );
  }
  return email;
}
