import { z } from "zod";
import { ProductionId } from "./running-order.ts";

/** The menu pages whose opening is recorded (usage-tracking FR2), by their page name. */
export const MenuPageName = z.enum([
  "welcome",
  "running-order",
  "cast",
  "casting-overview",
  "casting-items",
  "production-overview",
  "help",
  "accounts",
  "usage",
]);

/**
 * Menu pages that have gone, whose stored uses the Usage page leaves out (production-props AC11):
 * Production's four pages became the Stage and Tech pages' views.
 */
export const RETIRED_MENU_PAGES = ["mic-plot", "props", "scenery", "sfx"] as const;

/**
 * Pages and views that went when the Overview replaced the Stage, Tech and Wardrobe pages
 * (production-overview FR13). Their stored uses are left out of the Usage page, which would
 * otherwise refuse them; Costume is Wardrobe's name before ADR 0027. The views share their
 * names with RETIRED_MENU_PAGES, but are view uses, not page uses, so they're listed apart.
 */
export const DEPARTMENT_PAGES = ["stage", "tech", "wardrobe", "costume"] as const;
export const DEPARTMENT_VIEWS = ["scenery", "props", "mic-plot", "sfx"] as const;

/** The views a page switches between, whose switching is recorded (FR2), with their uses. */
const VIEW_FEATURES = {
  "by-person": "overview-by-person",
  "by-item": "overview-by-item",
  grid: "overview-grid",
} as const;

/** The Casting Overview's views. */
export const PageView = z.enum(["by-person", "by-item", "grid"]);

/** The exports, whose use is recorded once the file is made (FR2). */
export const UsageExport = z.enum([
  "excel-grid",
  "word-casting-sheets",
  "word-item-overview",
  "word-props-list",
]);

const itemOnly = {
  productionId: ProductionId,
  // Ids are UUIDs (or slugs in tests): nothing else, so no free text can ride along.
  itemId: z.string().regex(/^[a-z0-9-]{1,40}$/i),
};

/**
 * POST /api/usage: one thing a team member did (usage-tracking FR1, FR2). Only what happened:
 * who comes from the sign-in, never the body, so anything else sent is dropped (ADR 0023).
 * 204 once recorded.
 */
export const RecordUsageRequest = z.discriminatedUnion("event", [
  z.object({ event: z.literal("session") }),
  z.object({ event: z.literal("page"), page: MenuPageName }),
  z.object({ event: z.literal("view"), view: PageView }),
  // Which item, never its title, cast or files: the Usage page looks the title up (FR2).
  z.object({ event: z.literal("item"), ...itemOnly }),
  // An item's Scenery page, counted apart from its casting page (production-scenery FR15).
  z.object({ event: z.literal("scenery"), ...itemOnly }),
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
  "scenery-page",
  "export-excel-grid",
  "export-word-casting-sheets",
  "export-word-item-overview",
  "export-word-props-list",
]);

/** What a use is a use of; a session isn't a use of anything. */
export function featureOf(request: RecordUsageRequest): UsageFeature | undefined {
  switch (request.event) {
    case "page":
      return request.page;
    case "view":
      return VIEW_FEATURES[request.view];
    case "item":
      return "item-page";
    case "scenery":
      return "scenery-page";
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

/** One feature's uses in the period, and how many different people made them (FR6). */
export const FeatureTotal = z.strictObject({
  feature: UsageFeature,
  uses: z.number().int().min(0),
  people: z.number().int().min(0),
});

/** One session or use in the activity list (FR7): who, what and when. */
export const UsageActivity = z.intersection(
  RecordUsageRequest,
  z.object({ username: z.string().min(1).max(128), at: z.iso.datetime() }),
);

/** GET /api/usage's query: the last 7, 30 or 90 days, 30 when not given (FR8). */
export const USAGE_RANGES = ["7", "30", "90"] as const;
export const UsageQuery = z.object({
  days: z.enum(USAGE_RANGES).transform(Number).default(30),
});

/** The most activity GET /api/usage sends, keeping its answer far below Lambda's 6 MB. */
export const ACTIVITY_LIMIT = 1000;

/**
 * GET /api/usage, admins only: the last 30 days' usage of everyone who has any. The page
 * lists every account, so people with none are added from the account list.
 */
export const UsageSummary = z.strictObject({
  /** When the first usage was recorded (FR11); null while nothing has been. */
  recordedSince: z.iso.datetime().nullable(),
  people: z.array(PersonUsage).max(1000),
  /** Every feature, used or not, in UsageFeature's order. */
  features: z.array(FeatureTotal).max(UsageFeature.options.length),
  /** The period's sessions and uses, newest first; only the newest ACTIVITY_LIMIT. */
  activity: z.array(UsageActivity).max(ACTIVITY_LIMIT),
});

export type MenuPageName = z.infer<typeof MenuPageName>;
export type PageView = z.infer<typeof PageView>;
export type UsageExport = z.infer<typeof UsageExport>;
export type RecordUsageRequest = z.infer<typeof RecordUsageRequest>;
export type UsageFeature = z.infer<typeof UsageFeature>;
export type PersonUsage = z.infer<typeof PersonUsage>;
export type FeatureTotal = z.infer<typeof FeatureTotal>;
export type UsageActivity = z.infer<typeof UsageActivity>;
export type UsageSummary = z.infer<typeof UsageSummary>;
