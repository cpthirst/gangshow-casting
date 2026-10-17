import { ADMIN_GROUP, adminOnlyRouteKeys } from "@app/shared";
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

/** A 403 if the route is admin-only and the caller isn't an admin; undefined to go ahead. */
export function adminOnlyRefusal(
  routeKey: string,
  groups: string[],
): APIGatewayProxyStructuredResultV2 | undefined {
  const adminOnly = adminOnlyRouteKeys.some((key) => key === routeKey);
  if (!adminOnly || groups.includes(ADMIN_GROUP)) return undefined;
  return {
    statusCode: 403,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Only admins can do this." }),
  };
}
