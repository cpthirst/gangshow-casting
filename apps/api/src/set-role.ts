import { SetRole } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { callerIs } from "./caller.ts";
import { findAccount } from "./find-account.ts";
import type { ApiEvent } from "./handler.ts";
import { jsonResponse, messageResponse, parseJson } from "./json.ts";
import type { Account, UserDirectory } from "./user-directory.ts";

/**
 * PUT /api/accounts/{username}/role: gives an account one of the three roles (team-roles
 * FR10). It also signs the account out everywhere, so the change takes effect at their next
 * sign-in (ADR 0018). An admin can't change their own role, and the only enabled admin
 * stays one, so the team is never left without an admin (FR14).
 */
export function createSetRole(directory: UserDirectory) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const request = SetRole.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };
    const account = await findAccount(directory, event);
    if (!account) return { statusCode: 404 };

    const caller = callerIs(event, account.username);
    if (caller === "unidentified") return { statusCode: 403 };
    if (caller === "self") return messageResponse(409, "You can't change your own role.");
    const { role } = request.data;
    if (role !== "admin" && (await isOnlyEnabledAdmin(directory, account))) {
      return messageResponse(
        409,
        `${account.username} is the only enabled admin, so they stay an admin.`,
      );
    }
    // The role first: if the sign-out then fails, the old token lapses within its lifetime.
    // Either way they're signed out, so a role always changes at the next sign-in.
    await directory.setRole(account.username, role);
    await directory.signOutEverywhere(account.username);
    return jsonResponse(200, { ...account, role });
  };
}

// Best effort: the pool has no transactions, so two admins demoting each other at the same
// moment could both pass. `pnpm account admin` gets an admin back (hosting FR14).
async function isOnlyEnabledAdmin(directory: UserDirectory, account: Account) {
  if (account.role !== "admin" || !account.enabled) return false;
  const isEnabledAdmin = ({ role, enabled }: Account) => role === "admin" && enabled;
  const admins = (await directory.list()).filter(isEnabledAdmin);
  return admins.length === 1;
}
