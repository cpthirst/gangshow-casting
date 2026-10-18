import type { AccountSummary, TeamRole } from "@app/shared";

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

/** Each role by the name the team knows it by (team-roles FR4), in the order offered. */
export const ROLE_NAMES: Record<TeamRole, string> = {
  admin: "Admin",
  casting: "Casting Team Member",
  "read-only": "Read-Only Team Member",
};

/** A role's name after "a" or "an", as in "Make sam a Casting Team Member". */
export const withArticle = (role: TeamRole) =>
  `${role === "admin" ? "an" : "a"} ${ROLE_NAMES[role]}`;

const CAN_DO: Record<TeamRole, string> = {
  admin: "can manage accounts, delete cast members and save running orders",
  casting: "can change the cast, casting and running order drafts",
  "read-only": "can only view the show",
};

/** Asked before a role change, which signs the person out so it takes effect (FR10). */
export const roleWarning = (username: string, role: TeamRole) =>
  `Make ${username} ${withArticle(role)}? They'll be signed out on every device, and ${CAN_DO[role]} when they sign back in.`;
