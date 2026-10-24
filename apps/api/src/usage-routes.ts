import { type PersonUsage, RecordUsageRequest, type UsageSummary } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { callerUsername } from "./caller.ts";
import type { ApiEvent, Handler } from "./handler.ts";
import { jsonResponse, parseJson } from "./json.ts";
import type { UsageRecord, UsageStore } from "./usage-store.ts";

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type Options = {
  now?: () => Date;
  /** Who is asking: the sign-in's username when hosted (ADR 0023). */
  who?: (event: ApiEvent) => string | undefined;
};

/** POST /api/usage records what the caller did; GET /api/usage, admins only, sums it up. */
export function createUsageRoutes(
  store: UsageStore,
  { now = () => new Date(), who = callerUsername }: Options = {},
): Record<"POST /api/usage" | "GET /api/usage", Handler> {
  return {
    async "POST /api/usage"(event): Promise<APIGatewayProxyStructuredResultV2> {
      const request = RecordUsageRequest.safeParse(parseJson(event.body));
      if (!request.success) return { statusCode: 400 };
      // Only the sign-in says who this is, never the body: refuse rather than guess.
      const username = who(event);
      if (username === undefined) return { statusCode: 403 };
      await store.record({ ...request.data, username, at: now().toISOString() });
      return { statusCode: 204 };
    },

    async "GET /api/usage"() {
      const from = new Date(now().getTime() - PERIOD_DAYS * DAY_MS).toISOString();
      const summary: UsageSummary = {
        recordedSince: (await store.recordedSince()) ?? null,
        people: byPerson(await store.since(from)),
      };
      return jsonResponse(200, summary);
    },
  };
}

/** Each person's sessions and latest one. Usernames ignore case in the pool, as on the page. */
function byPerson(records: UsageRecord[]): PersonUsage[] {
  const people = new Map<string, PersonUsage>();
  for (const { username, at } of records) {
    const key = username.toLowerCase();
    const person = people.get(key) ?? { username, sessions: 0, lastSession: at };
    people.set(key, {
      ...person,
      sessions: person.sessions + 1,
      lastSession: at > person.lastSession ? at : person.lastSession,
    });
  }
  return [...people.values()].sort((a, b) => a.username.localeCompare(b.username));
}
