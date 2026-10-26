import {
  type AccountSummary,
  type MenuPageName,
  type PageView,
  type PersonUsage,
  type RecordUsageRequest,
  type UsageExport,
  UsageFeature,
} from "@app/shared";
import { sortAccounts } from "./accounts.ts";

// How the Usage page reports what was recorded (services/usage.ts records it).

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

/** Each view, as "switched … to …" says it: its page, then the view. */
const viewNames: Record<PageView, [page: string, view: string]> = {
  "by-person": ["the Overview", "By person"],
  "by-item": ["the Overview", "By item"],
  grid: ["the Overview", "Grid"],
  scenery: ["Stage", "Scenery"],
  props: ["Stage", "Props"],
  "mic-plot": ["Tech", "Mic plot"],
  sfx: ["Tech", "SFX"],
};

const exportNames: Record<UsageExport, string> = {
  "excel-grid": "the Excel grid",
  "word-casting-sheets": "the Word casting sheets",
  "word-item-overview": "the Word item overview",
  "word-props-list": "the Word props list",
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
      return "signed in";
    case "page":
      return `opened ${titles.page(entry.page)}`;
    case "view": {
      const [page, view] = viewNames[entry.view];
      return `switched ${page} to ${view}`;
    }
    case "item": {
      const title = titles.item(entry.productionId, entry.itemId);
      if (title === null) return "opened an item";
      return title ? `opened ${title}` : "opened an item no longer in the running order";
    }
    case "export":
      return `exported ${exportNames[entry.export]}`;
  }
}

type OtherFeature = Exclude<UsageFeature, MenuPageName>;

/** What the Usage page calls each feature that isn't a menu page. */
const otherNames: Record<OtherFeature, string> = {
  "overview-by-person": "Overview: By person",
  "overview-by-item": "Overview: By item",
  "overview-grid": "Overview: Grid",
  "stage-scenery": "Stage: Scenery",
  "stage-props": "Stage: Props",
  "tech-mic-plot": "Tech: Mic plot",
  "tech-sfx": "Tech: SFX",
  "item-page": "Item pages",
  "export-excel-grid": "Export: Excel grid",
  "export-word-casting-sheets": "Export: Word casting sheets",
  "export-word-item-overview": "Export: Word item overview",
  "export-word-props-list": "Export: Word props list",
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
