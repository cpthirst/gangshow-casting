import type { CreatedAccount } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { findAccount } from "./find-account.ts";
import type { UserDirectory } from "./user-directory.ts";

/**
 * POST /api/accounts/{username}/password: a forgotten password's reset (ADR 0018). A new
 * temporary password, returned only here for the admin to pass on (never log it), then a
 * sign-out everywhere, as a forgotten password may also be a stolen one.
 */
export function createResetPassword(directory: UserDirectory, newPassword: () => string) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const account = await findAccount(directory, event);
    if (!account) return { statusCode: 404 };

    const temporaryPassword = newPassword();
    await directory.setPassword(account.username, temporaryPassword, "temporary");
    await directory.signOutEverywhere(account.username);
    const reset: CreatedAccount = { account, temporaryPassword };
    return jsonResponse(200, reset);
  };
}
