// The hosted API's Lambda entry point (ADR 0017): API Gateway has already refused anyone
// not signed in (ADR 0018), so this only finds the route's handler, as dev-server.ts does.
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent, Handler } from "./handler.ts";
import { handler as health } from "./health.ts";
import { matchRoute } from "./match-route.ts";

/** The parts of an HTTP API (payload v2) event the entry point reads; payload v2 always has them. */
export type LambdaEvent = ApiEvent & {
  rawPath: string;
  requestContext: { http: { method: string } };
};

export function lambdaEntry(table: Record<string, Handler>) {
  return async (event: LambdaEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const route = matchRoute(table, event.requestContext.http.method, event.rawPath);
    if (!route) return { statusCode: 404 };
    return route.handler({ ...event, ...route.event });
  };
}

// Only the health route is hosted so far; the data routes follow (hosting E2.S1).
export const handler = lambdaEntry({ "GET /api/health": health });
