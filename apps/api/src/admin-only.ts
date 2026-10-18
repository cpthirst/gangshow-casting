import { adminOnlyRouteKeys, isReadRoute, READ_ONLY_REFUSAL, roleFrom } from "@app/shared";
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
 * A 403 if the caller's role doesn't allow the route; undefined to go ahead. Read-only
 * members, which includes anyone in no known group, may only read (ADR 0020), and
 * admin-only routes need an admin (ADR 0018).
 */
export function roleRefusal(
  routeKey: string,
  groups: string[],
): APIGatewayProxyStructuredResultV2 | undefined {
  const role = roleFrom(groups);
  if (!isReadRoute(routeKey) && role === "read-only") return refusal(READ_ONLY_REFUSAL);
  const adminOnly = adminOnlyRouteKeys.some((key) => key === routeKey);
  if (adminOnly && role !== "admin") return refusal("Only admins can do this.");
  return undefined;
}
