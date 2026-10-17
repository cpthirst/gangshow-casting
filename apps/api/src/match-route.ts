import type { Handler } from "./handler.ts";

/** Finds the route for a request, as API Gateway would: its key, handler and path parameters. */
export function matchRoute(table: Record<string, Handler>, method: string, path: string) {
  const pathSegments = path.split("/");
  for (const [route, handler] of Object.entries(table)) {
    const [routeMethod, routePath] = route.split(" ");
    const routeSegments = routePath?.split("/") ?? [];
    if (routeMethod !== method || routeSegments.length !== pathSegments.length) continue;
    const pathParameters = matchSegments(routeSegments, pathSegments);
    if (pathParameters) return { key: route, handler, event: { pathParameters } };
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
