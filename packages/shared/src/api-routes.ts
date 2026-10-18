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
  "PUT /api/productions/{productionId}/items/{itemId}/notes",
  "POST /api/productions/{productionId}/items/{itemId}/roles",
  "PUT /api/productions/{productionId}/roles/{roleId}",
  "DELETE /api/productions/{productionId}/roles/{roleId}",
] as const;

export type RouteKey = (typeof routeKeys)[number];

/** The user pool's admin group (infra/lib/app-stack.ts), named in a token's cognito:groups. */
export const ADMIN_GROUP = "admin";

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
