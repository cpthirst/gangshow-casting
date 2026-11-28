import { once } from "node:events";
import { isChangeWithinProduction, pastProductionRefusal, routeKeys } from "@app/shared";
import { describe, expect, it, vi } from "vitest";
import { startDevServer } from "#/dev-server.ts";
import { handler as hosted } from "#/lambda.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { noProductions } from "./access.ts";
import { lambdaEntry } from "./lambda-entry.ts";
import { request } from "./request.fixture.ts";

const REFUSAL = pastProductionRefusal(["2027", "2028"]);

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
    const res = await api(request(method, address, {}, groups));
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

    await expect(
      api(request("POST", "/api/productions/2027/cast", {}, "[admin]")),
    ).rejects.toThrow();
    expect(reached).not.toHaveBeenCalled();
  });

  it("is refused by the hosted API, on its real list", async () => {
    const res = await hosted(request("POST", "/api/productions/1999/cast", {}, "[admin]"));

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

describe("a change to a store", () => {
  const send = async (store: string, groups: string) => {
    const reached = vi.fn(async () => ({ statusCode: 200 }));
    const api = lambdaEntry(
      { "POST /api/stores/{storeId}/uploads": reached },
      inMemoryProductionListStore(["2027", "2028"]),
    );
    const res = await api(request("POST", `/api/stores/${store}/uploads`, {}, groups));
    return { res, ran: reached.mock.calls.length > 0 };
  };

  it.each([
    ["scenery", "[stage]"],
    ["props", "[stage]"],
    ["wardrobe", "[wardrobe]"],
    ["scenery", "[admin]"],
    ["wardrobe", "[admin]"],
  ])("lets the %s store be changed with %s", async (store, groups) => {
    expect((await send(store, groups)).ran).toBe(true);
  });

  it.each([
    ["scenery", "[director]", "You can view the scenery, but not change it."],
    ["scenery", "[tech]", "You can view the scenery, but not change it."],
    ["props", "[wardrobe director]", "You can view the props, but not change them."],
    ["wardrobe", "[stage tech director]", "You can view the wardrobe, but not change it."],
    ["scenery", "[]", "You can view the scenery, but not change it."],
  ])(
    "refuses a change to the %s store from %s with the department's refusal",
    async (store, groups, message) => {
      const { res, ran } = await send(store, groups);

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body ?? "")).toEqual({ message, department: store });
      expect(ran).toBe(false);
    },
  );

  it("refuses a Director's removal of a Scenery store image with the Scenery department's refusal", async () => {
    const reached = vi.fn(async () => ({ statusCode: 204 }));
    const api = lambdaEntry(
      { "DELETE /api/stores/{storeId}/images": reached },
      inMemoryProductionListStore(["2027", "2028"]),
    );

    const res = await api(
      request(
        "DELETE",
        "/api/stores/scenery/images",
        { queryStringParameters: { name: "throne.jpg" } },
        "[director]",
      ),
    );

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "You can view the scenery, but not change it.",
      department: "scenery",
    });
    expect(reached).not.toHaveBeenCalled();
  });

  it("lets nobody but an admin past for a store the list doesn't hold, so a gap fails safe", async () => {
    const refused = await send("sfx", "[stage tech wardrobe director]");

    expect(refused.res.statusCode).toBe(403);
    expect(refused.ran).toBe(false);
    expect((await send("sfx", "[admin]")).ran).toBe(true);
  });
});
