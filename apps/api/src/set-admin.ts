import { SetAdmin } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { callerIs } from "./caller.ts";
import { findAccount } from "./find-account.ts";
import type { ApiEvent } from "./handler.ts";
import { jsonResponse, messageResponse, parseJson } from "./json.ts";
import type { UserDirectory } from "./user-directory.ts";

/**
 * PUT /api/accounts/{username}/admin: makes an account an admin, through the admin group, or
 * not (hosting FR11). It also signs the account out everywhere, so the change takes effect
 * within the hour (ADR 0018), and an admin can't remove their own role, so one always remains
 * (FR13).
 */
export function createSetAdmin(directory: UserDirectory) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = SetAdmin.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };
    const account = await findAccount(directory, event);
    if (!account) return { statusCode: 404 };

    const { admin } = request.data;
    if (!admin) {
      const caller = callerIs(event, account.username);
      if (caller === "unidentified") return { statusCode: 403 };
      if (caller === "self") return messageResponse(409, "You can't remove your own admin role.");
    }
    // The role first: if the sign-out then fails, the old token's admin lapses within the hour.
    // Either way they're signed out, so a role always changes at the next sign-in.
    await directory.setAdmin(account.username, admin);
    await directory.signOutEverywhere(account.username);
    return jsonResponse(200, { ...account, admin });
  };
}
