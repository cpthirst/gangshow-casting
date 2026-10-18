/** What the app knows about a team member's account: their username and nothing else (ADR 0018). */
export type Account = { username: string; enabled: boolean; admin: boolean };

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
   * A new, enabled, non-admin account that must choose a new password at first sign-in.
   * Throws UsernameTaken if the username exists in any case.
   */
  create(username: string, temporaryPassword: string): Promise<void>;
  setPassword(username: string, password: string, kind: PasswordKind): Promise<void>;
  setEnabled(username: string, enabled: boolean): Promise<void>;
  setAdmin(username: string, admin: boolean): Promise<void>;
  /** Ends every sign-in the account has, on every device. */
  signOutEverywhere(username: string): Promise<void>;
}

type StoredAccount = Account & {
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
  const existing = (username: string) => {
    const account = stored.get(key(username));
    if (!account) throw new Error(`No account named ${username}`);
    return account;
  };

  const directory: UserDirectory = {
    async find(username) {
      const account = stored.get(key(username));
      return (
        account && { username: account.username, enabled: account.enabled, admin: account.admin }
      );
    },
    async list() {
      return [...stored.values()].map(({ username, enabled, admin }) => ({
        username,
        enabled,
        admin,
      }));
    },
    async create(username, temporaryPassword) {
      if (stored.has(key(username))) throw new UsernameTaken(username);
      stored.set(key(username), {
        username,
        enabled: true,
        admin: false,
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
    async setAdmin(username, admin) {
      existing(username).admin = admin;
    },
    async signOutEverywhere(username) {
      existing(username).signedOutEverywhere++;
    },
  };
  return { directory, accounts: () => [...stored.values()].map((account) => ({ ...account })) };
}
