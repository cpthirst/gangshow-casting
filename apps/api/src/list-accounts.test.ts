import { AccountList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createListAccounts } from "./list-accounts.ts";
import { memoryUserDirectory } from "./user-directory.ts";

// Made-up usernames only (CLAUDE.md safeguarding).
const account = (
  username: string,
  flags: { admin?: boolean; readOnly?: boolean; enabled?: boolean } = {},
) => ({
  username,
  admin: flags.admin ?? false,
  casting: !flags.admin && !flags.readOnly,
  readOnly: flags.readOnly ?? false,
  enabled: flags.enabled ?? true,
  password: "Made-up-1",
  passwordKind: "permanent" as const,
  signedOutEverywhere: 0,
});

describe("list accounts handler", () => {
  it("returns every account, with its role and whether it is disabled", async () => {
    const { directory } = memoryUserDirectory([
      account("pat", { admin: true }),
      account("sam"),
      account("jo", { readOnly: true }),
      account("lee", { enabled: false }),
    ]);

    const res = await createListAccounts(directory)();

    expect(res.statusCode).toBe(200);
    expect(AccountList.parse(JSON.parse(res.body ?? "")).accounts).toEqual([
      { username: "pat", role: "admin", enabled: true },
      { username: "sam", role: "casting", enabled: true },
      { username: "jo", role: "read-only", enabled: true },
      { username: "lee", role: "casting", enabled: false },
    ]);
  });
});
