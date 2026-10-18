import { AccountList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createListAccounts } from "./list-accounts.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up usernames only (CLAUDE.md safeguarding).
const account = (username: string, flags: { admin?: boolean; enabled?: boolean } = {}) => ({
  username,
  admin: flags.admin ?? false,
  enabled: flags.enabled ?? true,
  password: "Made-up-1",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
});

describe("list accounts handler", () => {
  it("returns every account, with which are admins and which are disabled", async () => {
    const { directory } = memoryUserDirectory([
      account("pat", { admin: true }),
      account("sam"),
      account("lee", { enabled: false }),
    ]);

    const res = await createListAccounts(directory)();

    expect(res.statusCode).toBe(200);
    expect(AccountList.parse(JSON.parse(res.body ?? "")).accounts).toEqual([
      { username: "pat", admin: true, enabled: true },
      { username: "sam", admin: false, enabled: true },
      { username: "lee", admin: false, enabled: false },
    ]);
  });
});
