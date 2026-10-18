// The hosted functions' shared Lambda entry (ADR 0017): API Gateway has already refused
// anyone not signed in (ADR 0018), so this finds the route's handler, as dev-server.ts
// does, and keeps admin-only routes for admins.
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { adminOnlyRefusal, groupsFrom } from "./admin-only.ts";
import type { ApiEvent, Handler } from "./handler.ts";
import { matchRoute } from "./match-route.ts";

/** The parts of an HTTP API (payload v2) event the entry point reads; payload v2 always has them. */
export type LambdaEvent = ApiEvent & {
  rawPath: string;
  requestContext: {
    http: { method: string };
    /** The signed-in token's claims, from API Gateway's JWT authorizer. */
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
  isBase64Encoded?: boolean;
};

// Responses hold cast data, so browsers mustn't keep them, even after sign-out (ADR 0017).
const noStore = (res: APIGatewayProxyStructuredResultV2): APIGatewayProxyStructuredResultV2 => ({
  ...res,
  headers: { ...res.headers, "cache-control": "no-store" },
});

export function lambdaEntry(table: Record<string, Handler>) {
  return async (event: LambdaEvent) => noStore(await respond(table, event));
}

async function respond(
  table: Record<string, Handler>,
  event: LambdaEvent,
): Promise<APIGatewayProxyStructuredResultV2> {
  const route = matchRoute(table, event.requestContext.http.method, event.rawPath);
  if (!route) return { statusCode: 404 };
  const groups = groupsFrom(event.requestContext.authorizer?.jwt?.claims?.["cognito:groups"]);
  const refused = adminOnlyRefusal(route.key, groups);
  if (refused) return refused;
  // API Gateway base64-encodes bodies it doesn't take for text; handlers expect the text.
  const decoded =
    event.isBase64Encoded && event.body !== undefined
      ? { body: Buffer.from(event.body, "base64").toString("utf8") }
      : {};
  return route.handler({ ...event, ...decoded, ...route.event });
}
