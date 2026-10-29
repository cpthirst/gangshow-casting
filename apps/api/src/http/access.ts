import { type Access, mayChange, needOf, refusalFor } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { messageResponse } from "./json.ts";

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

/**
 * A 403 if the caller's access doesn't allow the route; undefined to go ahead (ADR 0026).
 * Each route needs any one of the permissions the shared table names (ADR 0029), a route
 * missing from it an admin, and the reads and recording usage nothing.
 */
export function accessRefusal(
  routeKey: string,
  access: Access,
): APIGatewayProxyStructuredResultV2 | undefined {
  if (access === "admin") return undefined;
  const need = needOf(routeKey);
  if (need === undefined) return undefined;
  if (need === "admin") return messageResponse(403, "Only admins can do this.");
  return mayChange(access, need) ? undefined : messageResponse(403, refusalFor(need));
}
