/**
 * Every API route, as "<METHOD> <path>" with {name} path parameters. The API has a handler
 * for each (apps/api/src/routes.ts), and infra hosts exactly these, so a route can't be
 * served locally but missing, or unguarded, when hosted.
 */
export const routeKeys = [
  "GET /api/health",
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
  "DELETE /api/productions/{productionId}/cast/{castId}",
  "POST /api/productions/{productionId}/running-order/versions",
];
