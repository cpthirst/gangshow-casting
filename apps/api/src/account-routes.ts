import type { AccountRouteKey } from "@app/shared";
import { createCreateAccount } from "./create-account.ts";
import type { Handler } from "./handler.ts";
import { createListAccounts } from "./list-accounts.ts";
import { generatePassword } from "./password.ts";
import { createResetPassword } from "./reset-password.ts";
import { createSetAdmin } from "./set-admin.ts";
import { createSetEnabled } from "./set-enabled.ts";
import type { UserDirectory } from "./user-directory.ts";

/** A handler for each account route, on the team's directory (ADR 0018). */
export function createAccountRoutes(
  directory: UserDirectory,
  newPassword: () => string = generatePassword,
): Record<AccountRouteKey, Handler> {
  return {
    "GET /api/accounts": createListAccounts(directory),
    "POST /api/accounts": createCreateAccount(directory, newPassword),
    "POST /api/accounts/{username}/password": createResetPassword(directory, newPassword),
    "PUT /api/accounts/{username}/enabled": createSetEnabled(directory),
    "PUT /api/accounts/{username}/admin": createSetAdmin(directory),
  };
}
