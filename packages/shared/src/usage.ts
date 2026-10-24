import { z } from "zod";
import { ProductionId } from "./running-order.ts";

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

/** The Casting Overview's views, whose switching is recorded (FR2). */
export const OverviewView = z.enum(["by-person", "by-item", "grid"]);

/** The exports, whose use is recorded once the file is made (FR2). */
export const UsageExport = z.enum(["excel-grid", "word-casting-sheets", "word-item-overview"]);

/**
 * POST /api/usage: one thing a team member did (usage-tracking FR1, FR2). Only what happened:
 * who comes from the sign-in, never the body, so anything else sent is dropped (ADR 0023).
 * 204 once recorded.
 */
export const RecordUsageRequest = z.discriminatedUnion("event", [
  z.object({ event: z.literal("session") }),
  z.object({ event: z.literal("page"), page: MenuPageName }),
  z.object({ event: z.literal("view"), view: OverviewView }),
  // Which item, never its title or cast: the Usage page looks the title up (FR2).
  z.object({
    event: z.literal("item"),
    productionId: ProductionId,
    // Ids are UUIDs (or slugs in tests): nothing else, so no free text can ride along.
    itemId: z.string().regex(/^[a-z0-9-]{1,40}$/i),
  }),
  z.object({ event: z.literal("export"), export: UsageExport }),
]);

/** Everything counted as a use. Its order is the order the Usage page lists them in. */
export const UsageFeature = z.enum([
  ...MenuPageName.options,
  "overview-by-person",
  "overview-by-item",
  "overview-grid",
  // Every item's page together: the summary doesn't count items one by one.
  "item-page",
  "export-excel-grid",
  "export-word-casting-sheets",
  "export-word-item-overview",
]);

/** What a use is a use of; a session isn't a use of anything. */
export function featureOf(request: RecordUsageRequest): UsageFeature | undefined {
  switch (request.event) {
    case "page":
      return request.page;
    case "view":
      return `overview-${request.view}`;
    case "item":
      return "item-page";
    case "export":
      return `export-${request.export}`;
    case "session":
      return undefined;
  }
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
export type OverviewView = z.infer<typeof OverviewView>;
export type UsageExport = z.infer<typeof UsageExport>;
export type RecordUsageRequest = z.infer<typeof RecordUsageRequest>;
export type UsageFeature = z.infer<typeof UsageFeature>;
export type PersonUsage = z.infer<typeof PersonUsage>;
export type UsageSummary = z.infer<typeof UsageSummary>;
