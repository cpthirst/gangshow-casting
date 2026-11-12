/** An API Gateway HTTP API (payload v2) event with the token's claims as API Gateway's JWT
 *  authorizer passes them on. */
const signedIn = (claims: Record<string, string>, method: string, rawPath: string) => ({
  rawPath,
  requestContext: { http: { method }, authorizer: { jwt: { claims } } },
});

/** The parts of an event that the entry point reads, signed in with the token's groups: a
 *  Casting Team Member unless a test says otherwise. extra: the path parameters, query or body. */
export const request = (method: string, rawPath: string, extra = {}, groups = "[casting]") => ({
  ...signedIn({ sub: "made-up", "cognito:groups": groups }, method, rawPath),
  ...extra,
});

/** The same, signed in as `username`, for routes that act on who is asking; body, if any, is
 *  sent as JSON. */
export const requestAs = (
  username: string,
  groups: string,
  method: string,
  rawPath: string,
  body?: unknown,
) => ({
  ...signedIn({ username, "cognito:groups": groups }, method, rawPath),
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
