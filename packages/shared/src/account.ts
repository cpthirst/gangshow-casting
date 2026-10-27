import { z } from "zod";
import { permissions } from "./api-routes.ts";

/** The name an admin chooses for a team member's account: the only data held about them (ADR 0018). */
export const Username = z
  .string()
  .regex(
    /^[A-Za-z0-9._-]{1,32}$/,
    "A username is 1–32 letters, digits, dots, hyphens or underscores.",
  );

export type Username = z.infer<typeof Username>;

/**
 * What an account may do (ADR 0026): everything as an Admin, or any mix of the department
 * permissions, each at most once. No permissions means read-only.
 */
export const AccountAccess = z.union([
  z.literal("admin"),
  z
    .array(z.enum(permissions))
    .refine((list) => new Set(list).size === list.length, "A permission is listed twice"),
]);

export type AccountAccess = z.infer<typeof AccountAccess>;

/** An account as admins see it: who, and what they may do (hosting FR11, production-props FR6). */
export const AccountSummary = z.strictObject({
  username: Username,
  access: AccountAccess,
  enabled: z.boolean(),
});

/** GET /api/accounts: every account in the team's directory. */
export const AccountList = z.strictObject({ accounts: z.array(AccountSummary) });

/**
 * POST /api/accounts takes this: who, and what they may do (production-props FR6). The API chooses
 * the temporary password.
 */
export const NewAccount = z.strictObject({ username: Username, access: AccountAccess });

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

/** PUT /api/accounts/{username}/access takes this; 200 returns the AccountSummary. */
export const SetAccess = z.strictObject({ access: AccountAccess });

export type AccountSummary = z.infer<typeof AccountSummary>;
export type AccountList = z.infer<typeof AccountList>;
export type NewAccount = z.infer<typeof NewAccount>;
export type CreatedAccount = z.infer<typeof CreatedAccount>;
export type SetEnabled = z.infer<typeof SetEnabled>;
export type SetAccess = z.infer<typeof SetAccess>;
