import type { App } from "aws-cdk-lib";

/** The budget alert's address, given at deploy time (`-c alertEmail=…`) so it's never
 *  committed (remote-data FR13). */
export function alertEmailFrom(app: App): string {
  const email: unknown = app.node.tryGetContext("alertEmail");
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(
      "Give the budget alert's email address: cdk deploy -c alertEmail=you@example.com",
    );
  }
  return email;
}
