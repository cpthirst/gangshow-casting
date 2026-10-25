import {
  type Access,
  ADMIN_GROUP,
  accessFrom,
  type Permission,
  permissions,
  READ_ONLY_GROUP,
} from "@app/shared";

/** What the app knows about a team member's account: their username and nothing else (ADR 0018). */
export type Account = { username: string; enabled: boolean; access: Access };

export type PasswordKind = "temporary" | "permanent";

/** Usernames are case-insensitive, so "Sam" is taken once "sam" exists. */
export class UsernameTaken extends Error {}

/**
 * The team's accounts: the Cognito user pool when hosted, in memory locally and in tests.
 * Creating an account never sends an invitation: accounts have no email or phone.
 */
export interface UserDirectory {
  find(username: string): Promise<Account | undefined>;
  list(): Promise<Account[]>;
  /**
   * A new, enabled account with the access, that must choose a new password at first sign-in.
   * Throws UsernameTaken if the username exists in any case.
   */
  create(username: string, temporaryPassword: string, access: Access): Promise<void>;
  setPassword(username: string, password: string, kind: PasswordKind): Promise<void>;
  setEnabled(username: string, enabled: boolean): Promise<void>;
  /**
   * Puts the account in the admin group, or in each of its permissions' groups, and out of
   * every other (ADR 0026). A read-only account is in no group: the read-only group is retiring.
   */
  setAccess(username: string, access: Access): Promise<void>;
  /** The usernames of accounts in the retiring read-only group (ADR 0026). */
  inReadOnlyGroup(): Promise<string[]>;
  /**
   * Takes the account out of the read-only group and every other known group, which
   * read-only cancelled, so it stays read-only (ADR 0026). Returns the other groups it left.
   */
  leaveReadOnlyGroup(username: string): Promise<string[]>;
  /** Ends every sign-in the account has, on every device. */
  signOutEverywhere(username: string): Promise<void>;
}

/** In the admin, department and retiring read-only groups; a department left out is not. */
type StoredAccount = Omit<Account, "access"> &
  Partial<Record<Permission, boolean>> & {
    admin: boolean;
    readOnly: boolean;
    password: string;
    passwordKind: PasswordKind;
    signedOutEverywhere: number;
  };

type GroupFlags = Pick<StoredAccount, "admin" | "readOnly"> & Record<Permission, boolean>;

/**
 * Which groups an in-memory account is in for the access: admin alone, or each of its
 * permissions. Never read-only, as that group is retiring (ADR 0026).
 */
export function groupFlags(access: Access): GroupFlags {
  const has = (permission: Permission) => access !== "admin" && access.includes(permission);
  return {
    admin: access === "admin",
    readOnly: false,
    casting: has("casting"),
    stage: has("stage"),
    tech: has("tech"),
    costume: has("costume"),
  };
}

/**
 * An in-memory directory. Usernames are case-insensitive, as in the user pool. `accounts()`
 * shows what a real pool would hold, for tests.
 */
export function memoryUserDirectory(seed: StoredAccount[] = []) {
  const key = (username: string) => username.toLowerCase();
  const stored = new Map(seed.map((account) => [key(account.username), { ...account }]));
  const groupsOf = (account: StoredAccount) => [
    ...(account.admin ? [ADMIN_GROUP] : []),
    ...permissions.filter((permission) => account[permission] === true),
  ];
  // Through accessFrom, as the API reads a token's groups: read-only cancels, and no group is read-only.
  const summary = (account: StoredAccount): Account => ({
    username: account.username,
    enabled: account.enabled,
    access: accessFrom([...groupsOf(account), ...(account.readOnly ? [READ_ONLY_GROUP] : [])]),
  });
  const existing = (username: string) => {
    const account = stored.get(key(username));
    if (!account) throw new Error(`No account named ${username}`);
    return account;
  };

  const directory: UserDirectory = {
    async find(username) {
      const account = stored.get(key(username));
      return account && summary(account);
    },
    async list() {
      return [...stored.values()].map(summary);
    },
    async create(username, temporaryPassword, access) {
      if (stored.has(key(username))) throw new UsernameTaken(username);
      stored.set(key(username), {
        username,
        enabled: true,
        ...groupFlags(access),
        password: temporaryPassword,
        passwordKind: "temporary",
        signedOutEverywhere: 0,
      });
    },
    async setPassword(username, password, kind) {
      Object.assign(existing(username), { password, passwordKind: kind });
    },
    async setEnabled(username, enabled) {
      existing(username).enabled = enabled;
    },
    async setAccess(username, access) {
      Object.assign(existing(username), groupFlags(access));
    },
    async inReadOnlyGroup() {
      return [...stored.values()]
        .filter((account) => account.readOnly)
        .map((account) => account.username);
    },
    async leaveReadOnlyGroup(username) {
      const account = existing(username);
      const others = groupsOf(account);
      Object.assign(account, groupFlags([]));
      return others;
    },
    async signOutEverywhere(username) {
      existing(username).signedOutEverywhere++;
    },
  };
  return { directory, accounts: () => [...stored.values()].map((account) => ({ ...account })) };
}
