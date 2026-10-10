import { fileURLToPath } from "node:url";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createGetRunningOrder } from "./get-running-order.ts";
import { handler as health } from "./health.ts";
import { fileRunningOrderStore } from "./running-order-store.ts";

/** The parts of the API Gateway event that handlers use; a real Lambda event satisfies it. */
export type ApiEvent = Pick<APIGatewayProxyEventV2, "pathParameters">;

export type Handler = (event: ApiEvent) => Promise<APIGatewayProxyStructuredResultV2>;

// Git-ignored: real production data never goes in the repo (CLAUDE.md safeguarding).
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));
const runningOrders = fileRunningOrderStore(dataDir);

/** One entry per future API Gateway route: "<METHOD> <path>", with {name} path parameters. */
export const routes: Record<string, Handler> = {
  "GET /api/health": health,
  "GET /api/productions/{productionId}/running-order": createGetRunningOrder(runningOrders),
};

/** Finds the handler for a request, as API Gateway would, with any path parameters. */
export function matchRoute(table: Record<string, Handler>, method: string, path: string) {
  for (const [route, handler] of Object.entries(table)) {
    const [routeMethod, routePath = ""] = route.split(" ");
    const names: string[] = [];
    const pattern = routePath.replace(/\{(\w+)\}/g, (_placeholder, name: string) => {
      names.push(name);
      return "([^/]+)";
    });
    const match = new RegExp(`^${pattern}$`).exec(path);
    if (routeMethod !== method || !match) continue;
    const pathParameters = Object.fromEntries(
      names.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? "")]),
    );
    return { handler, event: { pathParameters } };
  }
  return undefined;
}
