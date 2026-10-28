// The accounts function's Lambda entry point: the only function allowed to change the
// team's accounts (ADR 0017, ADR 0018). Infra sets USER_POOL_ID to the team's pool.
import { createAccountRoutes } from "#/accounts/account-routes.ts";
import { cognitoClientFor, cognitoUserDirectory } from "#/accounts/cognito-user-directory.ts";
import { lambdaEntry } from "#/http/lambda-entry.ts";

const userPoolId = process.env.USER_POOL_ID;
if (!userPoolId) throw new Error("The accounts function needs USER_POOL_ID");

export const handler = lambdaEntry(
  createAccountRoutes(cognitoUserDirectory(cognitoClientFor(userPoolId), userPoolId)),
);
