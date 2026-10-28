import { type Access, needOf, refusalFor } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/**
 * The groups in a token's cognito:groups claim. API Gateway's JWT authorizer passes a list
 * on as one string, such as "[crew admin]". Group names can hold punctuation but not spaces,
 * so only spaces separate them. Anything unexpected means no groups.
 */
export function groupsFrom(claim: unknown): string[] {
  if (typeof claim !== "string") return [];
  return claim
    .replace(/^\[|\]$/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

const refusal = (message: string): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 403,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message }),
});

/**
 * A 403 if the caller's access doesn't allow the route; undefined to go ahead (ADR 0026).
 * Each route needs what the shared table names, a route missing from it an admin, and the
 * reads and recording usage nothing.
 */
export function accessRefusal(
  routeKey: string,
  access: Access,
): APIGatewayProxyStructuredResultV2 | undefined {
  if (access === "admin") return undefined;
  const need = needOf(routeKey);
  if (need === undefined) return undefined;
  if (need === "admin") return refusal("Only admins can do this.");
  return access.includes(need) ? undefined : refusal(refusalFor(need));
}
