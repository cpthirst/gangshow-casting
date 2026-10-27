import { SetAccess } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { callerIs } from "./caller.ts";
import { findAccount } from "./find-account.ts";
import type { ApiEvent } from "./handler.ts";
import { jsonResponse, messageResponse, parseJson } from "./json.ts";
import type { Account, UserDirectory } from "./user-directory.ts";

/**
 * PUT /api/accounts/{username}/access: makes an account an Admin, or gives it any mix of
 * permissions (production-props FR6). It also signs the account out everywhere, so the change
 * takes effect at their next sign-in (ADR 0018). An admin can't change their own access, and
 * the only enabled admin stays one, so the team is never left without an admin (FR8).
 */
export function createSetAccess(directory: UserDirectory) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = SetAccess.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };
    const account = await findAccount(directory, event);
    if (!account) return { statusCode: 404 };

    const caller = callerIs(event, account.username);
    if (caller === "unidentified") return { statusCode: 403 };
    if (caller === "self") return messageResponse(409, "You can't change your own access.");
    const { access } = request.data;
    if (access !== "admin" && (await isOnlyEnabledAdmin(directory, account))) {
      return messageResponse(
        409,
        `${account.username} is the only enabled admin, so they stay an admin.`,
      );
    }
    // The access first: if the sign-out then fails, the old token lapses within its lifetime.
    // Either way they're signed out, so access always changes at the next sign-in.
    await directory.setAccess(account.username, access);
    await directory.signOutEverywhere(account.username);
    return jsonResponse(200, { ...account, access });
  };
}

// Best effort: the pool has no transactions, so two admins demoting each other at the same
// moment could both pass. `pnpm account admin` gets an admin back (hosting FR14).
async function isOnlyEnabledAdmin(directory: UserDirectory, account: Account) {
  if (account.access !== "admin" || !account.enabled) return false;
  const isEnabledAdmin = ({ access, enabled }: Account) => access === "admin" && enabled;
  const admins = (await directory.list()).filter(isEnabledAdmin);
  return admins.length === 1;
}
