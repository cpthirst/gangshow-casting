import { memoryUserDirectory } from "./user-directory.ts";

// Made-up usernames only (CLAUDE.md safeguarding).
export const anAccount = (
  username: string,
  flags: {
    admin?: boolean;
    casting?: boolean;
    readOnly?: boolean;
    enabled?: boolean;
    password?: string;
  } = {},
) => ({
  username,
  admin: flags.admin ?? false,
  // In no role group unless asked, like every non-admin before team roles (ADR 0020).
  casting: flags.casting ?? false,
  readOnly: flags.readOnly ?? false,
  enabled: flags.enabled ?? true,
  password: flags.password ?? "Made-up-own-1",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
});

/** A directory holding "pat" (an admin) and "sam", both signed in with their own passwords. */
export const aTeamDirectory = () =>
  memoryUserDirectory([anAccount("pat", { admin: true }), anAccount("sam")]);

/** A request to an account route, signed in as `caller`. */
export const asCaller = (caller: string, username: string, body?: unknown) => ({
  pathParameters: { username },
  requestContext: { authorizer: { jwt: { claims: { username: caller } } } },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
