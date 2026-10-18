import { z } from "zod";

/** The name an admin chooses for a team member's account: the only data held about them (ADR 0018). */
export const Username = z
  .string()
  .regex(
    /^[A-Za-z0-9._-]{1,32}$/,
    "A username is 1–32 letters, digits, dots, hyphens or underscores.",
  );

export type Username = z.infer<typeof Username>;

/** What a signed-in team member may do (team-roles FR1, ADR 0020). */
export const TeamRole = z.enum(["admin", "casting", "read-only"]);

export type TeamRole = z.infer<typeof TeamRole>;

/** An account as admins see it: who, and what they may do (hosting FR11). */
export const AccountSummary = z.strictObject({
  username: Username,
  role: TeamRole,
  enabled: z.boolean(),
});

/** GET /api/accounts: every account in the team's directory. */
export const AccountList = z.strictObject({ accounts: z.array(AccountSummary) });

/** POST /api/accounts takes this; the API chooses the temporary password. */
export const NewAccount = z.strictObject({ username: Username, role: TeamRole });

/**
 * POST /api/accounts' 201, and POST /api/accounts/{username}/password's 200 (a reset): the
 * temporary password is shown to the admin once, never stored.
 */
export const CreatedAccount = z.strictObject({
  account: AccountSummary,
  temporaryPassword: z.string().min(1),
});

/** PUT /api/accounts/{username}/enabled takes this; 200 returns the AccountSummary. */
export const SetEnabled = z.strictObject({ enabled: z.boolean() });

/** PUT /api/accounts/{username}/role takes this; 200 returns the AccountSummary. */
export const SetRole = z.strictObject({ role: TeamRole });

export type AccountSummary = z.infer<typeof AccountSummary>;
export type AccountList = z.infer<typeof AccountList>;
export type NewAccount = z.infer<typeof NewAccount>;
export type CreatedAccount = z.infer<typeof CreatedAccount>;
export type SetEnabled = z.infer<typeof SetEnabled>;
export type SetRole = z.infer<typeof SetRole>;
