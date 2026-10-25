import type { TeamRole } from "@app/shared";
import type { PasswordKind, UserDirectory } from "./user-directory.ts";

type NewPassword = () => string;

/**
 * Gives the account a fresh password of the given kind, enabled and in the given role,
 * creating it if it's missing. Returns the password, which nothing else holds.
 */
async function putAccount(
  directory: UserDirectory,
  username: string,
  { role, kind }: { role: TeamRole; kind: PasswordKind },
  newPassword: NewPassword,
) {
  const password = newPassword();
  const existing = await directory.find(username);
  if (existing) {
    await directory.setPassword(username, password, kind);
    await directory.setEnabled(username, true);
    await directory.setRole(username, role);
    // A forgotten password may also be a stolen one.
    await directory.signOutEverywhere(username);
  } else {
    await directory.create(username, password, role);
    // A new account's password is always temporary, so a permanent one takes a second step.
    if (kind === "permanent") await directory.setPassword(username, password, kind);
  }
  return { created: !existing, password };
}

/**
 * Creates the first admin, or gets an admin back in after a lockout (hosting FR14): enabled,
 * an admin, and a new temporary password they must change at their next sign-in.
 */
export function restoreAdmin(directory: UserDirectory, username: string, newPassword: NewPassword) {
  return putAccount(directory, username, { role: "admin", kind: "temporary" }, newPassword);
}

/** The post-deploy check's accounts: one in each role (hosting FR17, team-roles FR15). */
export type CheckAccounts = { admin: string; member: string; readOnly: string };

/**
 * Sets up the check's accounts with permanent passwords, so the check can sign in without
 * the first-login change. Returns each one's password.
 */
export async function setUpCheckAccounts(
  directory: UserDirectory,
  usernames: CheckAccounts,
  newPassword: NewPassword,
): Promise<CheckAccounts> {
  const put = async (username: string, role: TeamRole) =>
    (await putAccount(directory, username, { role, kind: "permanent" }, newPassword)).password;
  return {
    admin: await put(usernames.admin, "admin"),
    member: await put(usernames.member, "casting"),
    readOnly: await put(usernames.readOnly, "read-only"),
  };
}

/**
 * Takes every account out of the retiring read-only group (ADR 0026), with any other group
 * it cancelled, and says how many accounts there are and which had other groups. Each is
 * left in no group, so still may only read, and nothing is ever added, so it's safe to
 * run again.
 */
export async function moveOutOfReadOnly(directory: UserDirectory) {
  const moved = await directory.inReadOnlyGroup();
  const hadOthers = [];
  for (const username of moved) {
    if ((await directory.leaveReadOnlyGroup(username)).length > 0) hadOthers.push(username);
  }
  return { checked: (await directory.list()).length, moved, hadOthers };
}
