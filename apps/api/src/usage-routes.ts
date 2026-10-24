import {
  type FeatureTotal,
  featureOf,
  type PersonUsage,
  RecordUsageRequest,
  UsageFeature,
  type UsageSummary,
} from "@app/shared";
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
      const records = await store.since(from);
      const summary: UsageSummary = {
        recordedSince: (await store.recordedSince()) ?? null,
        people: byPerson(records),
        features: byFeature(records),
      };
      return jsonResponse(200, summary);
    },
  };
}

/** Each person's sessions, latest session and uses. Usernames ignore case in the pool, as on the page. */
function byPerson(records: UsageRecord[]): PersonUsage[] {
  const people = new Map<string, PersonUsage>();
  for (const record of records) {
    const key = record.username.toLowerCase();
    const person = people.get(key) ?? {
      username: record.username,
      sessions: 0,
      lastSession: null,
      uses: {},
    };
    people.set(key, withRecord(person, record));
  }
  return [...people.values()].sort((a, b) => a.username.localeCompare(b.username));
}

function withRecord(person: PersonUsage, record: UsageRecord): PersonUsage {
  const feature = featureOf(record);
  if (feature) {
    return { ...person, uses: { ...person.uses, [feature]: (person.uses[feature] ?? 0) + 1 } };
  }
  const { lastSession } = person;
  return {
    ...person,
    sessions: person.sessions + 1,
    lastSession: lastSession && lastSession > record.at ? lastSession : record.at,
  };
}

/** Every feature's uses and the different people who made them; sessions aren't uses. */
function byFeature(records: UsageRecord[]): FeatureTotal[] {
  return UsageFeature.options.map((feature) => {
    const uses = records.filter((record) => featureOf(record) === feature);
    const people = new Set(uses.map(({ username }) => username.toLowerCase()));
    return { feature, uses: uses.length, people: people.size };
  });
}
