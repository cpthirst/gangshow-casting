import { createAccountRoutes } from "./account-routes.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up accounts (CLAUDE.md safeguarding): an admin, a member and a disabled member.
const madeUp = (username: string, admin: boolean, enabled: boolean) => ({
  username,
  admin,
  casting: !admin,
  readOnly: false,
  enabled,
  password: "Made-up-local-1",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
});

/**
 * The account routes for pnpm dev and pnpm demo, on a made-up directory in memory: no AWS,
 * and a fresh start each time the API does (ADR 0018).
 */
export const localAccountRoutes = () =>
  createAccountRoutes(
    memoryUserDirectory([
      madeUp("alex", true, true),
      madeUp("robin", false, true),
      madeUp("kit", false, false),
    ]).directory,
  );
