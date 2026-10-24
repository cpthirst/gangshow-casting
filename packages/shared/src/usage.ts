import { z } from "zod";

/** The menu pages whose opening is recorded (usage-tracking FR2), by their page name. */
export const MenuPageName = z.enum([
  "welcome",
  "running-order",
  "cast",
  "casting-overview",
  "casting-items",
  "accounts",
  "usage",
]);

/**
 * POST /api/usage: one thing a team member did (usage-tracking FR1, FR2). Only what happened:
 * who comes from the sign-in, never the body, so anything else sent is dropped (ADR 0023).
 * 204 once recorded.
 */
export const RecordUsageRequest = z.discriminatedUnion("event", [
  z.object({ event: z.literal("session") }),
  z.object({ event: z.literal("page"), page: MenuPageName }),
]);

/** Everything counted as a use. Its order is the order the Usage page lists them in. */
export const UsageFeature = MenuPageName;

/** What a use is a use of; a session isn't a use of anything. */
export function featureOf(request: RecordUsageRequest): UsageFeature | undefined {
  return request.event === "page" ? request.page : undefined;
}

/** One person's sessions and uses in the period, by their username. */
export const PersonUsage = z.strictObject({
  username: z.string().min(1).max(128),
  sessions: z.number().int().min(0),
  /** Their latest session in the period; null if they had only uses in it. */
  lastSession: z.iso.datetime().nullable(),
  /** How many times they used each feature; a feature they didn't use is left out. */
  uses: z.partialRecord(UsageFeature, z.number().int().min(1)),
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

export type MenuPageName = z.infer<typeof MenuPageName>;
export type RecordUsageRequest = z.infer<typeof RecordUsageRequest>;
export type UsageFeature = z.infer<typeof UsageFeature>;
export type PersonUsage = z.infer<typeof PersonUsage>;
export type UsageSummary = z.infer<typeof UsageSummary>;
