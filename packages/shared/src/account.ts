import { z } from "zod";

/** The name an admin chooses for a team member's account: the only data held about them (ADR 0018). */
export const Username = z
  .string()
  .regex(
    /^[A-Za-z0-9._-]{1,32}$/,
    "A username is 1–32 letters, digits, dots, hyphens or underscores.",
  );

export type Username = z.infer<typeof Username>;

/** An account as admins see it: who, and what they may do (hosting FR11). */
export const AccountSummary = z.strictObject({
  username: Username,
  admin: z.boolean(),
  enabled: z.boolean(),
});

/** GET /api/accounts: every account in the team's directory. */
export const AccountList = z.strictObject({ accounts: z.array(AccountSummary) });

/** POST /api/accounts takes this; the API chooses the temporary password. */
export const NewAccount = z.strictObject({ username: Username });

/** POST /api/accounts' 201: the temporary password is shown to the admin once, never stored. */
export const CreatedAccount = z.strictObject({
  account: AccountSummary,
  temporaryPassword: z.string().min(1),
});

export type AccountSummary = z.infer<typeof AccountSummary>;
export type AccountList = z.infer<typeof AccountList>;
export type NewAccount = z.infer<typeof NewAccount>;
export type CreatedAccount = z.infer<typeof CreatedAccount>;
