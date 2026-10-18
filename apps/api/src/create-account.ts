import { type CreatedAccount, NewAccount } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import { type UserDirectory, UsernameTaken } from "./user-directory.ts";

const message = (statusCode: number, text: string): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: text }),
});

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
      return usernameIssue ? message(400, usernameIssue.message) : { statusCode: 400 };
    }

    const { username } = request.data;
    const temporaryPassword = newPassword();
    try {
      await directory.create(username, temporaryPassword);
    } catch (error) {
      if (error instanceof UsernameTaken) return message(409, "That username is already taken.");
      throw error;
    }
    const created: CreatedAccount = {
      account: { username, admin: false, enabled: true },
      temporaryPassword,
    };
    return {
      statusCode: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(created),
    };
  };
}
