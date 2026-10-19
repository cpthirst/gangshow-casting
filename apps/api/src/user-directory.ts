import { ADMIN_GROUP, CASTING_GROUP, READ_ONLY_GROUP, roleFrom, type TeamRole } from "@app/shared";

/** What the app knows about a team member's account: their username and nothing else (ADR 0018). */
export type Account = { username: string; enabled: boolean; role: TeamRole };

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
   * A new, enabled account in the role, that must choose a new password at first sign-in.
   * Throws UsernameTaken if the username exists in any case.
   */
  create(username: string, temporaryPassword: string, role: TeamRole): Promise<void>;
  setPassword(username: string, password: string, kind: PasswordKind): Promise<void>;
  setEnabled(username: string, enabled: boolean): Promise<void>;
  /** Puts the account in the role, and out of any other (ADR 0020). */
  setRole(username: string, role: TeamRole): Promise<void>;
  /** The usernames of accounts in no role group, which the API treats as read-only (ADR 0020). */
  withoutRole(): Promise<string[]>;
  /** Makes the account a Casting Team Member. */
  joinCasting(username: string): Promise<void>;
  /** Ends every sign-in the account has, on every device. */
  signOutEverywhere(username: string): Promise<void>;
}

type StoredAccount = Omit<Account, "role"> & {
  /** In the admin, casting and read-only groups. */
  admin: boolean;
  casting: boolean;
  readOnly: boolean;
  password: string;
  passwordKind: PasswordKind;
  signedOutEverywhere: number;
};

/**
 * An in-memory directory. Usernames are case-insensitive, as in the user pool. `accounts()`
 * shows what a real pool would hold, for tests.
 */
export function memoryUserDirectory(seed: StoredAccount[] = []) {
  const key = (username: string) => username.toLowerCase();
  const stored = new Map(seed.map((account) => [key(account.username), { ...account }]));
  // Through roleFrom, as the API reads a token's groups: read-only wins, and no group is read-only.
  const summary = ({ username, enabled, ...groups }: StoredAccount): Account => ({
    username,
    enabled,
    role: roleFrom(
      [
        groups.admin && ADMIN_GROUP,
        groups.casting && CASTING_GROUP,
        groups.readOnly && READ_ONLY_GROUP,
      ].filter((group) => typeof group === "string"),
    ),
  });
  const groupsFor = (role: TeamRole) => ({
    admin: role === "admin",
    casting: role === "casting",
    readOnly: role === "read-only",
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
    async create(username, temporaryPassword, role) {
      if (stored.has(key(username))) throw new UsernameTaken(username);
      stored.set(key(username), {
        username,
        enabled: true,
        ...groupsFor(role),
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
    async setRole(username, role) {
      Object.assign(existing(username), groupsFor(role));
    },
    async withoutRole() {
      return [...stored.values()]
        .filter((account) => !account.admin && !account.casting && !account.readOnly)
        .map((account) => account.username);
    },
    async joinCasting(username) {
      existing(username).casting = true;
    },
    async signOutEverywhere(username) {
      existing(username).signedOutEverywhere++;
    },
  };
  return { directory, accounts: () => [...stored.values()].map((account) => ({ ...account })) };
}
