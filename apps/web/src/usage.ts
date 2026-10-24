import {
  type AccountSummary,
  MenuPageName,
  type OverviewView,
  type PersonUsage,
  type RecordUsageRequest,
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

/** Records switching the Casting Overview to another view. */
export const recordView = (view: OverviewView) => record({ event: "view", view });

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
};

const isOtherFeature = (feature: UsageFeature): feature is OtherFeature =>
  Object.hasOwn(otherNames, feature);

/** A feature's name: a menu page by its title in the menu (`titleOf`), so the two agree. */
export const featureName = (feature: UsageFeature, titleOf: (page: MenuPageName) => string) =>
  isOtherFeature(feature) ? otherNames[feature] : titleOf(feature);

/** A person's uses, such as "Running order 3, Cast 1", in the order features are listed. */
export function usesOf(uses: PersonUsage["uses"], nameOf: (feature: UsageFeature) => string) {
  const used = UsageFeature.options.flatMap((feature) => {
    const count = uses[feature];
    return count ? [`${nameOf(feature)} ${count}`] : [];
  });
  return used.length > 0 ? used.join(", ") : "No uses";
}

/** Every account, alphabetically, with its usage; none for an account with no usage. */
export function usageByAccount(accounts: AccountSummary[], people: PersonUsage[]) {
  // Usernames ignore case in the pool, so "Robin" in the sign-in is the account "robin".
  const usageOf = new Map(people.map((person) => [person.username.toLowerCase(), person]));
  return sortAccounts(accounts).map(({ username }) => ({
    username,
    usage: usageOf.get(username.toLowerCase()),
  }));
}
