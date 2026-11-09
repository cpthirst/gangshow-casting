import { once } from "node:events";
import { isChangeWithinProduction, pastProductionRefusal, routeKeys } from "@app/shared";
import { describe, expect, it, vi } from "vitest";
import { startDevServer } from "#/dev-server.ts";
import { handler as hosted } from "#/lambda.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { noProductions } from "./access.ts";
import { lambdaEntry } from "./lambda-entry.ts";

const REFUSAL = pastProductionRefusal(["2027", "2028"]);

const request = (method: string, rawPath: string, groups: string) => ({
  rawPath,
  requestContext: {
    http: { method },
    authorizer: { jwt: { claims: { sub: "made-up", "cognito:groups": groups } } },
  },
});

/** Every route, each with a stand-in handler, on productions 2027 and 2028. */
function everyRoute() {
  const reached = vi.fn(async () => ({ statusCode: 200 }));
  const api = lambdaEntry(
    Object.fromEntries(routeKeys.map((key) => [key, reached])),
    inMemoryProductionListStore(["2027", "2028"]),
  );
  const send = async (key: string, year: string, groups: string) => {
    reached.mockClear();
    const [method = "", path = ""] = key.split(" ");
    const address = path.replaceAll("{productionId}", year).replaceAll(/\{\w+\}/g, "x");
    const res = await api(request(method, address, groups));
    return { res, ran: reached.mock.calls.length > 0 };
  };
  return send;
}

const changes = routeKeys.filter(isChangeWithinProduction);
const EVERYONE = ["[admin]", "[casting stage tech wardrobe director]", "[]"];

describe("a past production", () => {
  it.each(EVERYONE)("refuses every change to it from groups %s", async (groups) => {
    const send = everyRoute();

    for (const key of changes) {
      const { res, ran } = await send(key, "2027", groups);

      expect(res.statusCode, key).toBe(403);
      expect(JSON.parse(res.body ?? ""), key).toEqual(REFUSAL);
      expect(ran, key).toBe(false);
    }
  });

  it("lets an admin make every change to the newest", async () => {
    const send = everyRoute();

    for (const key of changes) expect((await send(key, "2028", "[admin]")).ran, key).toBe(true);
  });

  it("refuses a change to a production the list doesn't hold", async () => {
    const send = everyRoute();

    const { res, ran } = await send(changes[0] ?? "", "1999", "[admin]");

    expect(res.statusCode).toBe(403);
    expect(ran).toBe(false);
  });

  it("still applies the department's rule to the newest", async () => {
    const send = everyRoute();

    const { res, ran } = await send("POST /api/productions/{productionId}/cast", "2028", "[stage]");

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? "")).toMatchObject({ department: "casting" });
    expect(ran).toBe(false);
  });

  it.each([
    "GET /api/productions/{productionId}/cast",
    "GET /api/productions/{productionId}/items/{itemId}/scenery-file-link",
    "POST /api/productions/{productionId}/casting-grid/export",
  ])("still lets anyone use %s on it", async (key) => {
    const send = everyRoute();

    expect((await send(key, "2027", "[]")).ran).toBe(true);
  });

  it("leaves starting a production to the admins, wherever they're looking", async () => {
    const send = everyRoute();

    expect((await send("POST /api/productions", "2027", "[admin]")).ran).toBe(true);
  });

  it("fails closed if a function with no productions is ever given a route within one", async () => {
    const reached = vi.fn(async () => ({ statusCode: 200 }));
    const key = "POST /api/productions/{productionId}/cast";
    const api = lambdaEntry({ [key]: reached }, noProductions);

    await expect(api(request("POST", "/api/productions/2027/cast", "[admin]"))).rejects.toThrow();
    expect(reached).not.toHaveBeenCalled();
  });

  it("is refused by the hosted API, on its real list", async () => {
    const res = await hosted(request("POST", "/api/productions/1999/cast", "[admin]"));

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? "")).toMatchObject({ message: REFUSAL.message });
  });

  it("is refused by the dev server too, for its local admin", async () => {
    const server = startDevServer(0);
    await once(server, "listening");
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    const res = await fetch(`http://localhost:${address.port}/api/productions/1999/cast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ message: REFUSAL.message });
  });
});
