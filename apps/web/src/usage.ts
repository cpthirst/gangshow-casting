import {
  type AccountSummary,
  MenuPageName,
  type OverviewView,
  type PersonUsage,
  type RecordUsageRequest,
  type UsageExport,
  UsageFeature,
} from "@app/shared";
import { sortAccounts } from "./accounts.ts";
import { apiFetch } from "./sign-in.ts";

export const USAGE_PATH = "/api/usage";

/**
 * Records something the person did (usage-tracking FR1, FR2). Never awaited by what they're
 * doing, and a failure is ignored, so recording can't get in their way (FR3).
 */
function record(request: RecordUsageRequest) {
  apiFetch(USAGE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  }).catch(() => {});
}

/** Records that someone started using the app. */
export const recordSession = () => record({ event: "session" });

/**
 * Records opening a page, if it's a menu page; any other page isn't recorded. The router's
 * page names are the shared MenuPageName values, so renaming a page there means renaming it
 * there too.
 */
export function recordPageUse(pageName: unknown) {
  const page = MenuPageName.safeParse(pageName);
  if (page.success) record({ event: "page", page: page.data });
}

// The team is in Chester: dates are as they were in the UK.
const ukDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

/** An ISO time as its UK date, such as "24 October 2026". */
export const dayOf = (iso: string) => ukDay.format(new Date(iso));

const ukClock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
});

/** An ISO time as its UK date and time, such as "24 October 2026 19:01". */
export const whenOf = (iso: string) => `${dayOf(iso)} ${ukClock.format(new Date(iso))}`;

const viewNames: Record<OverviewView, string> = {
  "by-person": "By person",
  "by-item": "By item",
  grid: "Grid",
};

const exportNames: Record<UsageExport, string> = {
  "excel-grid": "the Excel grid",
  "word-casting-sheets": "the Word casting sheets",
  "word-item-overview": "the Word item overview",
};

type Titles = {
  page: (page: MenuPageName) => string;
  /**
   * An item's title; undefined once it's no longer in the running order, and null while
   * the running order can't be loaded.
   */
  item: (productionId: string, itemId: string) => string | undefined | null;
};

/** What a session or use was, as the activity list says it, such as "opened Running order". */
export function whatHappened(entry: RecordUsageRequest, titles: Titles) {
  switch (entry.event) {
    case "session":
      return "session";
    case "page":
      return `opened ${titles.page(entry.page)}`;
    case "view":
      return `switched the Overview to ${viewNames[entry.view]}`;
    case "item": {
      const title = titles.item(entry.productionId, entry.itemId);
      if (title === null) return "opened an item";
      return title ? `opened ${title}` : "opened an item no longer in the running order";
    }
    case "export":
      return `exported ${exportNames[entry.export]}`;
  }
}

/** Records switching the Casting Overview to another view. */
export const recordView = (view: OverviewView) => record({ event: "view", view });

/** Records an export, once its file is made. */
export const recordExport = (kind: UsageExport) => record({ event: "export", export: kind });

/** Records opening an item's page: which item only, never its title or cast. */
export const recordItemUse = (productionId: string, itemId: string) =>
  record({ event: "item", productionId, itemId });

type OtherFeature = Exclude<UsageFeature, MenuPageName>;

/** What the Usage page calls each feature that isn't a menu page. */
const otherNames: Record<OtherFeature, string> = {
  "overview-by-person": "Overview: By person",
  "overview-by-item": "Overview: By item",
  "overview-grid": "Overview: Grid",
  "item-page": "Item pages",
  "export-excel-grid": "Export: Excel grid",
  "export-word-casting-sheets": "Export: Word casting sheets",
  "export-word-item-overview": "Export: Word item overview",
};

const isOtherFeature = (feature: UsageFeature): feature is OtherFeature =>
  Object.hasOwn(otherNames, feature);

/** A feature's name: a menu page by its title in the menu (`titleOf`), so the two agree. */
export const featureName = (feature: UsageFeature, titleOf: (page: MenuPageName) => string) =>
  isOtherFeature(feature) ? otherNames[feature] : titleOf(feature);

/** A person's uses, such as ["Running order 3", "Cast 1"], in the order features are listed. */
export const usesOf = (uses: PersonUsage["uses"], nameOf: (feature: UsageFeature) => string) =>
  UsageFeature.options.flatMap((feature) => {
    const count = uses[feature];
    return count ? [`${nameOf(feature)} ${count}`] : [];
  });

/** Every account, alphabetically, with its usage; none for an account with no usage. */
export function usageByAccount(accounts: AccountSummary[], people: PersonUsage[]) {
  // Usernames ignore case in the pool, so "Robin" in the sign-in is the account "robin".
  const usageOf = new Map(people.map((person) => [person.username.toLowerCase(), person]));
  return sortAccounts(accounts).map(({ username }) => ({
    username,
    usage: usageOf.get(username.toLowerCase()),
  }));
}
