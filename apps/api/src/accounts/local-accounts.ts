import type { Access } from "@app/shared";
import { createAccountRoutes } from "./account-routes.ts";
import { groupFlags, memoryUserDirectory } from "./user-directory.ts";

// Made-up accounts (CLAUDE.md safeguarding): an Admin, some mixes of permissions, a
// read-only account and a disabled one.
const madeUp = (username: string, access: Access, enabled: boolean) => ({
  username,
  ...groupFlags(access),
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
      madeUp("robin", ["casting"], true),
      madeUp("mo", ["stage", "tech"], true),
      madeUp("sky", [], true),
      madeUp("kit", ["casting"], false),
    ]).directory,
  );
