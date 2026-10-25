import { type CreatedAccount, NewAccount, roleAccess } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { jsonResponse, messageResponse, parseJson } from "./json.ts";
import { type UserDirectory, UsernameTaken } from "./user-directory.ts";

/**
 * POST /api/accounts: a new account with a temporary password, returned only here, for the
 * admin to pass on (ADR 0018). Never log it.
 */
export function createCreateAccount(directory: UserDirectory, newPassword: () => string) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = NewAccount.safeParse(parseJson(event.body));
    // Only the username comes from what an admin types; anything else wrong is a bad client.
    if (!request.success) {
      const usernameIssue = request.error.issues.find((issue) => issue.path[0] === "username");
      return usernameIssue ? messageResponse(400, usernameIssue.message) : { statusCode: 400 };
    }

    const { username, role } = request.data;
    const access = roleAccess[role];
    const temporaryPassword = newPassword();
    try {
      await directory.create(username, temporaryPassword, access);
    } catch (error) {
      if (error instanceof UsernameTaken)
        return messageResponse(409, "That username is already taken.");
      throw error;
    }
    const created: CreatedAccount = {
      account: { username, access, enabled: true },
      temporaryPassword,
    };
    return jsonResponse(201, created);
  };
}
