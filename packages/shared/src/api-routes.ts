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
  "PUT /api/accounts/{username}/admin",
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
] as const;

export type RouteKey = (typeof routeKeys)[number];

/** The user pool's admin group (infra/lib/app-stack.ts), named in a token's cognito:groups. */
export const ADMIN_GROUP = "admin";
/** The user pool's group for Casting Team Members, who may change casting (ADR 0020). */
export const CASTING_GROUP = "casting";
/** The user pool's group for Read-Only Team Members, who may only read (ADR 0020). */
export const READ_ONLY_GROUP = "read-only";

/** What a signed-in team member may do (team-roles FR1). */
export type TeamRole = "admin" | "casting" | "read-only";

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

/** Reads change nothing, so every role may use them; every other route is a change. */
export const isReadRoute = (key: string) => key.startsWith("GET ");

/**
 * Routes only admins may use: permanent or show-wide changes (hosting FR9). The API refuses
 * them for anyone else before the handler runs (ADR 0018), so a new one can't forget it.
 */
export const adminOnlyRouteKeys: readonly RouteKey[] = [
  "GET /api/accounts",
  "POST /api/accounts",
  "POST /api/accounts/{username}/password",
  "PUT /api/accounts/{username}/enabled",
  "PUT /api/accounts/{username}/admin",
  "DELETE /api/productions/{productionId}/cast/{castId}",
  "POST /api/productions/{productionId}/running-order/versions",
  "POST /api/productions/{productionId}/casting-grid/export",
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
  "PUT /api/accounts/{username}/admin",
] as const satisfies readonly RouteKey[];

export type AccountRouteKey = (typeof accountRouteKeys)[number];

const accountRoutes = new Set<string>(accountRouteKeys);

/** Whether a route key, such as one infra hosts, is an account route. */
export const isAccountRoute = (key: string) => accountRoutes.has(key);
