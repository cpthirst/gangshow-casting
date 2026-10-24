import type { AccountSummary, PersonUsage } from "@app/shared";
import { sortAccounts } from "./accounts.ts";
import { apiFetch } from "./sign-in.ts";

export const USAGE_PATH = "/api/usage";

/**
 * Records that someone started using the app (usage-tracking FR1). Never awaited by what
 * the person is doing, and a failure is ignored, so recording can't get in their way (FR3).
 */
export function recordSession() {
  apiFetch(USAGE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "session" }),
  }).catch(() => {});
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

/** Every account, alphabetically, with its usage; none for an account with no usage. */
export function usageByAccount(accounts: AccountSummary[], people: PersonUsage[]) {
  // Usernames ignore case in the pool, so "Robin" in the sign-in is the account "robin".
  const usageOf = new Map(people.map((person) => [person.username.toLowerCase(), person]));
  return sortAccounts(accounts).map(({ username }) => ({
    username,
    usage: usageOf.get(username.toLowerCase()),
  }));
}
