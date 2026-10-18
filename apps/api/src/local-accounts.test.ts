import type { Server } from "node:http";
import { AccountList, CreatedAccount } from "@app/shared";
import { afterEach, describe, expect, it } from "vitest";
import { createDevServer } from "./dev-server.ts";
import { localAccountRoutes } from "./local-accounts.ts";

let server: Server | undefined;
afterEach(
  () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
);

async function serve() {
  server = createDevServer(localAccountRoutes());
  await new Promise<void>((resolve) => server?.listen(0, resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("server not listening");
  return `http://localhost:${address.port}/api/accounts`;
}

// pnpm dev and pnpm demo run the dev server, which never contacts AWS (ADR 0018).
describe("accounts locally", () => {
  it("lists made-up accounts, including an admin and a disabled one", async () => {
    const url = await serve();

    const { accounts } = AccountList.parse(await (await fetch(url)).json());

    expect(accounts.some((account) => account.admin)).toBe(true);
    expect(accounts.some((account) => !account.enabled)).toBe(true);
  });

  it("creates an account, which the list then shows", async () => {
    const url = await serve();

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "jo" }),
    });
    const { accounts } = AccountList.parse(await (await fetch(url)).json());

    expect(res.status).toBe(201);
    expect(CreatedAccount.parse(await res.json()).temporaryPassword).not.toBe("");
    expect(accounts).toContainEqual({ username: "jo", admin: false, enabled: true });
  });

  it("starts afresh each time, so nothing created lasts past a restart", async () => {
    const created = localAccountRoutes();
    await created["POST /api/accounts"]({ body: JSON.stringify({ username: "jo" }) });

    const res = await localAccountRoutes()["GET /api/accounts"]({});

    expect(AccountList.parse(JSON.parse(res.body ?? "")).accounts).not.toContainEqual(
      expect.objectContaining({ username: "jo" }),
    );
  });
});
