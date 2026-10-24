import type { TeamRole } from "@app/shared";
import { createAccountRoutes } from "./account-routes.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up accounts (CLAUDE.md safeguarding): one in each role, and a disabled one.
const madeUp = (username: string, role: TeamRole, enabled: boolean) => ({
  username,
  admin: role === "admin",
  casting: role === "casting",
  readOnly: role === "read-only",
  enabled,
  password: "Made-up-local-1",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
});

/** The made-up admin the local app acts as, whose usage is recorded locally. */
export const LOCAL_ADMIN = "alex";

/**
 * The account routes for pnpm dev and pnpm demo, on a made-up directory in memory: no AWS,
 * and a fresh start each time the API does (ADR 0018).
 */
export const localAccountRoutes = () =>
  createAccountRoutes(
    memoryUserDirectory([
      madeUp(LOCAL_ADMIN, "admin", true),
      madeUp("robin", "casting", true),
      madeUp("sky", "read-only", true),
      madeUp("kit", "casting", false),
    ]).directory,
  );
