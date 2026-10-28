import { SetEnabled } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { callerIs } from "#/http/caller.ts";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, messageResponse, parseJson } from "#/http/json.ts";
import { findAccount } from "./find-account.ts";
import type { UserDirectory } from "./user-directory.ts";

/**
 * PUT /api/accounts/{username}/enabled: turns an account's access off or on (hosting FR11).
 * Disabling also signs it out everywhere, ending its access within 5 minutes (team-roles FR13), and
 * an admin can't disable themselves, so there's always an enabled admin (FR13).
 */
export function createSetEnabled(directory: UserDirectory) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = SetEnabled.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };
    const account = await findAccount(directory, event);
    if (!account) return { statusCode: 404 };

    const { enabled } = request.data;
    if (!enabled) {
      const caller = callerIs(event, account.username);
      if (caller === "unidentified") return { statusCode: 403 };
      if (caller === "self") return messageResponse(409, "You can't disable your own account.");
    }
    await directory.setEnabled(account.username, enabled);
    if (!enabled) await directory.signOutEverywhere(account.username);
    return jsonResponse(200, { ...account, enabled });
  };
}
