import type { ApiEvent } from "./handler.ts";

/**
 * Whether the signed-in caller is the given account, from the access token's username
 * claim; usernames ignore case, as in the pool. A signed-in request with no username is
 * "unidentified", and callers refuse it rather than guess. The dev server has no sign-in
 * and acts for an admin who is no account (ADR 0018), so there it's always "other".
 */
export function callerIs(event: ApiEvent, username: string): "self" | "other" | "unidentified" {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (claims === undefined) return "other";
  const caller = claims.username;
  if (typeof caller !== "string") return "unidentified";
  return caller.toLowerCase() === username.toLowerCase() ? "self" : "other";
}
