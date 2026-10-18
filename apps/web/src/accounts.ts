import type { AccountSummary } from "@app/shared";

export const ACCOUNTS_PATH = "/api/accounts";

// The platform's locale-aware comparison: usernames sort the same whatever their case.
const byName = new Intl.Collator("en-GB", { sensitivity: "base" });

export const sortAccounts = (accounts: AccountSummary[]) =>
  [...accounts].sort((a, b) => byName.compare(a.username, b.username));

/** The API address of one account, such as /api/accounts/sam. */
export const accountPath = (username: string) => `${ACCOUNTS_PATH}/${encodeURIComponent(username)}`;

/** Asked before a reset, which ends the person's sign-ins on every device. */
export const resetWarning = (username: string) =>
  `Reset ${username}'s password? They'll be signed out on every device, and need the new temporary password to sign in.`;

/** Asked before disabling, which ends the person's access everywhere (hosting FR12). */
export const disableWarning = (username: string) =>
  `Disable ${username}? They'll be signed out on every device within the hour, and can't sign in until an admin enables them again.`;
