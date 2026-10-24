import {
  MenuPageName,
  type OverviewView,
  type RecordUsageRequest,
  type UsageExport,
} from "@app/shared";
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

/** Records switching the Casting Overview to another view. */
export const recordView = (view: OverviewView) => record({ event: "view", view });

/** Records an export, once its file is made. */
export const recordExport = (kind: UsageExport) => record({ event: "export", export: kind });

/** Records opening an item's page: which item only, never its title or cast. */
export const recordItemUse = (productionId: string, itemId: string) =>
  record({ event: "item", productionId, itemId });
