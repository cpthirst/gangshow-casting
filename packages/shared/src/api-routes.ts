import type { TeamRole } from "./account.ts";

/**
 * Every API route, as "<METHOD> <path>" with {name} path parameters. The API has a handler
 * for each (apps/api/src/routes.ts), and infra hosts exactly these, so a route can't be
 * served locally but missing, or unguarded, when hosted.
 */
export const routeKeys = [
  "GET /api/health",
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/role",
  "GET /api/productions/{productionId}/running-order",
  "POST /api/productions/{productionId}/running-order/versions",
  "GET /api/productions/{productionId}/cast",
  "POST /api/productions/{productionId}/cast",
  "PUT /api/productions/{productionId}/cast/{castId}",
  "DELETE /api/productions/{productionId}/cast/{castId}",
  "GET /api/productions/{productionId}/roles",
  "GET /api/productions/{productionId}/item-notes",
  "POST /api/productions/{productionId}/casting-grid/export",
  "PUT /api/productions/{productionId}/items/{itemId}/notes",
  "POST /api/productions/{productionId}/items/{itemId}/roles",
  "PUT /api/productions/{productionId}/roles/{roleId}",
  "DELETE /api/productions/{productionId}/roles/{roleId}",
  "POST /api/usage",
  "GET /api/usage",
] as const;

export type RouteKey = (typeof routeKeys)[number];

/** The user pool's admin group (infra/lib/app-stack.ts), named in a token's cognito:groups. */
export const ADMIN_GROUP = "admin";
/** The user pool's group for Casting Team Members, who may change casting (ADR 0020). */
export const CASTING_GROUP = "casting";
/** The user pool's group for Read-Only Team Members, who may only read (ADR 0020). */
export const READ_ONLY_GROUP = "read-only";

/**
 * A token's groups as a role. An explicit read-only group always wins, so a mistaken extra
 * group can't widen access; then admin, then casting. Anything else, no group included, is
 * read-only, so a lost or unknown group never grants a change (ADR 0020).
 */
export function roleFrom(groups: readonly string[]): TeamRole {
  if (groups.includes(READ_ONLY_GROUP)) return "read-only";
  if (groups.includes(ADMIN_GROUP)) return "admin";
  if (groups.includes(CASTING_GROUP)) return "casting";
  return "read-only";
}

/** The API's answer to a change from a read-only member, which pages recognise (team-roles FR12). */
export const READ_ONLY_REFUSAL = "You have read-only access.";

/**
 * Which role pnpm dev and pnpm demo act for, chosen with the local role switch (team-roles
 * FR16). Only the local API reads it; the hosted API takes the role from the sign-in alone.
 */
export const LOCAL_ROLE_HEADER = "x-local-role";

/**
 * Routes that aren't a GET but change nothing stored. The export only turns the grid the page
 * sends into a file, so every role may use it (ADR 0021). Add one only for the same reason.
 */
const readsSentAsPost: ReadonlySet<string> = new Set<RouteKey>([
  "POST /api/productions/{productionId}/casting-grid/export",
]);

/** Reads change nothing stored, so every role may use them: every GET, plus the POSTs above. */
export const isReadRoute = (key: string) => key.startsWith("GET ") || readsSentAsPost.has(key);

/**
 * The one change read-only members may make: recording their own usage, which only ever
 * adds a record about the caller (ADR 0023). Add another only for the same reason.
 */
const recordsAboutTheCaller: ReadonlySet<string> = new Set<RouteKey>(["POST /api/usage"]);

/** What a read-only member may use: the reads, and recording their own usage. */
export const readOnlyMayUse = (key: string) => isReadRoute(key) || recordsAboutTheCaller.has(key);

/**
 * Routes only admins may use: permanent or show-wide changes (hosting FR9). The API refuses
 * them for anyone else before the handler runs (ADR 0018), so a new one can't forget it.
 */
export const adminOnlyRouteKeys: readonly RouteKey[] = [
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/role",
  "DELETE /api/productions/{productionId}/cast/{castId}",
  "POST /api/productions/{productionId}/running-order/versions",
  // Usage is about the team, so only admins read it (usage-tracking FR4).
  "GET /api/usage",
];

/**
 * Routes that manage the team's accounts. They run in their own function, the only one
 * allowed to change accounts (ADR 0017), so the data routes can't.
 */
export const accountRouteKeys = [
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/role",
] as const satisfies readonly RouteKey[];

export type AccountRouteKey = (typeof accountRouteKeys)[number];

const accountRoutes = new Set<string>(accountRouteKeys);

/** Whether a route key, such as one infra hosts, is an account route. */
export const isAccountRoute = (key: string) => accountRoutes.has(key);
