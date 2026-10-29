import {
  type AccountAccess,
  type AccountSummary,
  CASTING_GROUP,
  DIRECTOR_GROUP,
  type Permission,
  permissions,
} from "@app/shared";
import { departmentPages } from "./departments.ts";

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
  `Disable ${username}? They'll be signed out on every device within 5 minutes, and can't sign in until an admin enables them again.`;

/** Each department's permission by the name the team knows it by (production-props FR7). */
export const PERMISSION_NAMES: Record<Permission, string> = {
  casting: "Casting",
  stage: "Stage",
  tech: "Tech",
  wardrobe: "Wardrobe",
  director: "Director",
};

/** What an account may do, at a glance: "Admin", its permissions, or "Read-only". */
export function accessLabel(access: AccountAccess) {
  if (access === "admin") return "Admin";
  if (access.length === 0) return "Read-only";
  return inOrder(access)
    .map((permission) => PERMISSION_NAMES[permission])
    .join(", ");
}

/** Permissions in the order the page offers them, whatever order they were given in. */
export const inOrder = (access: readonly Permission[]) =>
  permissions.filter((permission) => access.includes(permission));

/** "A", "A and B", "A, B and C". */
const listed = (names: string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** What the permissions let someone change: casting, and each other department's page. */
function whatTheyCanChange(access: readonly Permission[]) {
  const casting = access.includes(CASTING_GROUP) ? ["casting"] : [];
  if (access.includes(DIRECTOR_GROUP)) {
    // A Director's pages take in every other department's (production-scenery FR1).
    const everyPage = `every production department's pages (${listed(departmentPages.map((page) => page.name))})`;
    return casting.length > 0
      ? `casting, and ${everyPage}`
      : `${everyPage}, but not the casting or the show`;
  }
  const pages = inOrder(access)
    .filter((permission) => permission !== CASTING_GROUP)
    .map((permission) => PERMISSION_NAMES[permission]);
  const pageWords =
    pages.length > 0 ? [`the ${listed(pages)} ${pages.length > 1 ? "pages" : "page"}`] : [];
  return [...casting, ...pageWords].join(", and ");
}

/** What the person will be able to do once they sign back in with the access. */
function whatTheyCanDo(access: AccountAccess) {
  if (access === "admin") {
    return "they'll be able to change everything, manage accounts, delete cast members and save running orders";
  }
  if (access.length === 0) return "they'll only be able to view the show";
  return `they'll be able to change ${whatTheyCanChange(access)}`;
}

/** Asked before an access change, which signs the person out so it takes effect (FR6). */
export function accessWarning(username: string, access: AccountAccess) {
  const question =
    access === "admin"
      ? `Make ${username} an Admin?`
      : access.length === 0
        ? `Make ${username} read-only?`
        : `Change ${username}'s access to ${accessLabel(access)}?`;
  return `${question} When they next sign in, ${whatTheyCanDo(access)}. ${username} will be signed out on every device.`;
}

/** Whether two accesses are the same, whatever order their permissions are in. */
export function sameAccess(a: AccountAccess, b: AccountAccess) {
  if (a === "admin" || b === "admin") return a === b;
  return inOrder(a).join() === inOrder(b).join();
}

/** Said once an access change has saved. */
export function accessChanged(username: string, access: AccountAccess) {
  if (access === "admin") return `${username} is now an Admin.`;
  if (access.length === 0) return `${username} is now read-only.`;
  return `${username} now has ${accessLabel(access)}.`;
}
