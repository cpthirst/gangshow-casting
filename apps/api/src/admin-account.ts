import type { PasswordKind, UserDirectory } from "./user-directory.ts";

type NewPassword = () => string;

/**
 * Gives the account a fresh password of the given kind, enabled, with or without admin,
 * creating it if it's missing. Returns the password, which nothing else holds.
 */
async function putAccount(
  directory: UserDirectory,
  username: string,
  { admin, kind }: { admin: boolean; kind: PasswordKind },
  newPassword: NewPassword,
) {
  const password = newPassword();
  const existing = await directory.find(username);
  if (existing) {
    await directory.setPassword(username, password, kind);
    await directory.setEnabled(username, true);
    // A forgotten password may also be a stolen one.
    await directory.signOutEverywhere(username);
  } else {
    await directory.create(username, password);
    // A new account's password is always temporary, so a permanent one takes a second step.
    if (kind === "permanent") await directory.setPassword(username, password, kind);
  }
  await directory.setAdmin(username, admin);
  return { created: !existing, password };
}

/**
 * Creates the first admin, or gets an admin back in after a lockout (hosting FR14): enabled,
 * an admin, and a new temporary password they must change at their next sign-in.
 */
export function restoreAdmin(directory: UserDirectory, username: string, newPassword: NewPassword) {
  return putAccount(directory, username, { admin: true, kind: "temporary" }, newPassword);
}

/**
 * The post-deploy check's two accounts, one admin and one not, with permanent passwords so
 * the check can sign in without the first-login change (hosting FR17).
 */
export async function setUpCheckAccounts(
  directory: UserDirectory,
  usernames: { admin: string; member: string },
  newPassword: NewPassword,
) {
  const admin = await putAccount(
    directory,
    usernames.admin,
    { admin: true, kind: "permanent" },
    newPassword,
  );
  const member = await putAccount(
    directory,
    usernames.member,
    { admin: false, kind: "permanent" },
    newPassword,
  );
  return { admin: admin.password, member: member.password };
}
