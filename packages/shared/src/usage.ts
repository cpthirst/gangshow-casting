import { z } from "zod";

/**
 * POST /api/usage: one thing a team member did (usage-tracking FR1). Only what happened:
 * who comes from the sign-in, never the body, so anything else sent is dropped (ADR 0023).
 * 204 once recorded.
 */
export const RecordUsageRequest = z.object({ event: z.literal("session") });

/** One person's sessions in the period, by their username. */
export const PersonUsage = z.strictObject({
  username: z.string().min(1).max(128),
  sessions: z.number().int().min(0),
  /** Their latest session in the period. */
  lastSession: z.iso.datetime(),
});

/**
 * GET /api/usage, admins only: the last 30 days' usage of everyone who has any. The page
 * lists every account, so people with none are added from the account list.
 */
export const UsageSummary = z.strictObject({
  /** When the first usage was recorded (FR11); null while nothing has been. */
  recordedSince: z.iso.datetime().nullable(),
  people: z.array(PersonUsage).max(1000),
});

export type RecordUsageRequest = z.infer<typeof RecordUsageRequest>;
export type PersonUsage = z.infer<typeof PersonUsage>;
export type UsageSummary = z.infer<typeof UsageSummary>;
