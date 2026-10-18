import type { AccountRouteKey } from "@app/shared";
import { createCreateAccount } from "./create-account.ts";
import type { Handler } from "./handler.ts";
import { createListAccounts } from "./list-accounts.ts";
import { generatePassword } from "./password.ts";
import type { UserDirectory } from "./user-directory.ts";

/** A handler for each account route, on the team's directory (ADR 0018). */
export function createAccountRoutes(
  directory: UserDirectory,
  newPassword: () => string = generatePassword,
): Record<AccountRouteKey, Handler> {
  return {
    "GET /api/accounts": createListAccounts(directory),
    "POST /api/accounts": createCreateAccount(directory, newPassword),
  };
}
