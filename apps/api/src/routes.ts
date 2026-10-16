import { fileURLToPath } from "node:url";
import { createAddCastMember } from "./add-cast-member.ts";
import { createAddRole } from "./add-role.ts";
import { fileCastStore } from "./cast-store.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetRoles } from "./get-roles.ts";
import { createGetRunningOrder } from "./get-running-order.ts";
import type { Handler } from "./handler.ts";
import { handler as health } from "./health.ts";
import { createRemoveRole } from "./remove-role.ts";
import { fileRoleStore } from "./role-store.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";
import { createUpdateRole } from "./update-role.ts";

// Git-ignored: real production data never goes in the repo (CLAUDE.md safeguarding).
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));
const runningOrders = fileRunningOrderStore(dataDir);
const cast = fileCastStore(dataDir);
const roles = fileRoleStore(dataDir);

/** One entry per future API Gateway route: "<METHOD> <path>", with {name} path parameters. */
export const routes: Record<string, Handler> = {
  "GET /api/health": health,
  "GET /api/productions/{productionId}/running-order": createGetRunningOrder(runningOrders),
  "POST /api/productions/{productionId}/running-order/versions":
    createSaveRunningOrder(runningOrders),
  "GET /api/productions/{productionId}/cast": createGetCast(cast),
  "POST /api/productions/{productionId}/cast": createAddCastMember(cast),
  "PUT /api/productions/{productionId}/cast/{castId}": createUpdateCastMember(cast),
  "DELETE /api/productions/{productionId}/cast/{castId}": createDeleteCastMember(cast, roles),
  "GET /api/productions/{productionId}/roles": createGetRoles(roles),
  "POST /api/productions/{productionId}/items/{itemId}/roles": createAddRole(
    roles,
    runningOrders,
    cast,
  ),
  "PUT /api/productions/{productionId}/roles/{roleId}": createUpdateRole(roles, cast),
  "DELETE /api/productions/{productionId}/roles/{roleId}": createRemoveRole(roles),
};

/** Finds the handler for a request, as API Gateway would, with any path parameters. */
export function matchRoute(table: Record<string, Handler>, method: string, path: string) {
  const pathSegments = path.split("/");
  for (const [route, handler] of Object.entries(table)) {
    const [routeMethod, routePath] = route.split(" ");
    const routeSegments = routePath?.split("/") ?? [];
    if (routeMethod !== method || routeSegments.length !== pathSegments.length) continue;
    const pathParameters = matchSegments(routeSegments, pathSegments);
    if (pathParameters) return { handler, event: { pathParameters } };
  }
  return undefined;
}

// "{name}" segments capture; every other segment must match exactly.
function matchSegments(routeSegments: string[], pathSegments: string[]) {
  const params: Record<string, string> = {};
  for (const [i, routeSegment] of routeSegments.entries()) {
    const segment = pathSegments[i] ?? "";
    const name = /^\{(\w+)\}$/.exec(routeSegment)?.[1];
    if (name === undefined) {
      if (routeSegment !== segment) return undefined;
      continue;
    }
    const value = safeDecode(segment);
    if (value === undefined || value === "") return undefined;
    params[name] = value;
  }
  return params;
}

// A malformed escape like "%E0%A4%A" is a bad request, not a crash.
function safeDecode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}
