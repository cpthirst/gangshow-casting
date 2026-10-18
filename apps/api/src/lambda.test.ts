import { CastList, HealthResponse, ItemNoteList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import type { Handler } from "./handler.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { handler } from "./lambda.ts";
import { lambdaEntry } from "./lambda-entry.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { createRoutes } from "./routes.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

// The parts of an API Gateway HTTP API (payload v2) event that the entry point reads.
const request = (method: string, rawPath: string, extra = {}) => ({
  rawPath,
  requestContext: { http: { method } },
  ...extra,
});

describe("Lambda entry point", () => {
  it("runs the health handler for GET /api/health", async () => {
    const res = await handler(request("GET", "/api/health"));

    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(JSON.parse(res.body ?? "")).status).toBe("ok");
  });

  it("passes the matched path parameters, query and body to the handler", async () => {
    const echo: Handler = async (event) => ({ statusCode: 200, body: JSON.stringify(event) });
    const entry = lambdaEntry({ "PUT /api/things/{thingId}": echo });

    const res = await entry(
      request("PUT", "/api/things/a%20b", {
        queryStringParameters: { q: "1" },
        body: '{"name":"x"}',
      }),
    );

    expect(JSON.parse(res.body ?? "")).toMatchObject({
      pathParameters: { thingId: "a b" },
      queryStringParameters: { q: "1" },
      body: '{"name":"x"}',
    });
  });

  it("returns 404 with no body for a path it doesn't serve", async () => {
    const res = await handler(request("GET", "/api/nope"));

    expect(res).toEqual({ statusCode: 404, headers: { "cache-control": "no-store" } });
  });

  it("tells browsers not to keep any response, found or not", async () => {
    const found = await handler(request("GET", "/api/health"));
    const missing = await handler(request("GET", "/api/nope"));
    const refused = await handler(request("DELETE", "/api/productions/2027/cast/1"));

    for (const res of [found, missing, refused]) {
      expect(res.headers).toMatchObject({ "cache-control": "no-store" });
    }
    expect(refused.statusCode).toBe(403);
  });

  it("decodes a body that API Gateway sent base64-encoded", async () => {
    const echo: Handler = async (event) => ({ statusCode: 200, body: event.body ?? "" });
    const entry = lambdaEntry({ "POST /api/things": echo });

    const res = await entry(
      request("POST", "/api/things", {
        body: Buffer.from('{"name":"x"}').toString("base64"),
        isBase64Encoded: true,
      }),
    );

    expect(res.body).toBe('{"name":"x"}');
  });

  // API Gateway lets only signed-in requests through (infra's authorizer, and the post-deploy
  // check), so every request that reaches the entry point is a signed-in one.
  describe("on the show's data", () => {
    const entry = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1)])]);
      const roles = inMemoryRoleStore();
      return lambdaEntry(
        createRoutes({
          cast,
          roles,
          runningOrders: inMemoryRunningOrderStore([
            aRunningOrder(3, { first: ["Pirate Sketch"] }),
          ]),
          itemNotes: inMemoryItemNoteStore(),
          removeCastMember: uncastThenRemove(cast, roles),
        }),
      );
    };

    it("returns the production's cast to a signed-in request", async () => {
      const res = await entry()(request("GET", "/api/productions/2027/cast"));

      expect(res.statusCode).toBe(200);
      expect(CastList.parse(JSON.parse(res.body ?? ""))).toEqual(aCastList([aCastMember(1)]));
    });

    it("saves a note on an item, which reading the notes then returns", async () => {
      const api = entry();
      const notesPath = `/api/productions/2027/items/${itemId("Pirate Sketch")}/notes`;

      const saved = await api(
        request("PUT", notesPath, { body: JSON.stringify({ revision: 0, text: "Hat change" }) }),
      );
      const read = await api(request("GET", "/api/productions/2027/item-notes"));

      expect(saved.statusCode).toBe(200);
      expect(ItemNoteList.parse(JSON.parse(read.body ?? "")).notes).toEqual([
        expect.objectContaining({ itemId: itemId("Pirate Sketch"), text: "Hat change" }),
      ]);
    });
  });

  describe("admin-only actions (ADR 0018)", () => {
    const alex = aCastMember(1, { firstName: "Alex", lastName: "Example" });
    const setUp = () => {
      const cast = inMemoryCastStore([aCastList([alex])]);
      const roles = inMemoryRoleStore();
      const runningOrders = inMemoryRunningOrderStore([aRunningOrder(4)]);
      const api = lambdaEntry(
        createRoutes({
          cast,
          roles,
          runningOrders,
          itemNotes: inMemoryItemNoteStore(),
          removeCastMember: uncastThenRemove(cast, roles),
        }),
      );
      return { api, cast, runningOrders };
    };
    // A signed-in token's groups, as API Gateway's JWT authorizer passes them on.
    const signedIn = (method: string, rawPath: string, groups?: string, extra = {}) => ({
      rawPath,
      requestContext: {
        http: { method },
        authorizer: {
          jwt: { claims: { sub: "made-up", ...(groups ? { "cognito:groups": groups } : {}) } },
        },
      },
      ...extra,
    });
    const deleteAlex = (groups?: string) =>
      signedIn("DELETE", "/api/productions/2027/cast/1", groups, {
        queryStringParameters: { revision: String(alex.revision) },
      });
    const saveVersion = (groups?: string) => {
      const { halves } = aRunningOrder(4);
      const change = { type: "update", halves: halves.map(({ id, items }) => ({ id, items })) };
      return signedIn("POST", "/api/productions/2027/running-order/versions", groups, {
        body: JSON.stringify({ baseVersion: 4, change }),
      });
    };

    it("refuses a non-admin's delete of a cast member, saying only admins can", async () => {
      const { api, cast } = setUp();

      for (const groups of [undefined, "[]", "[crew]", "[superadmin]", "[crew,admin]"]) {
        const res = await api(deleteAlex(groups));

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
      }
      expect((await cast.list("2027"))?.members).toEqual([alex]);
    });

    it("refuses a non-admin's new running-order version, keeping the latest", async () => {
      const { api, runningOrders } = setUp();

      const res = await api(saveVersion("[crew]"));

      expect(res.statusCode).toBe(403);
      expect((await runningOrders.latest("2027"))?.version).toBe(4);
    });

    const exportGrid = (groups?: string) =>
      signedIn("POST", "/api/productions/2027/casting-grid/export", groups, {
        body: JSON.stringify({
          items: [{ heading: "1.1 · Opening Number", printed: true }],
          rows: [{ firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["L"] }],
        }),
      });

    it("refuses a non-admin's casting grid export, returning no file", async () => {
      const { api } = setUp();

      for (const groups of [undefined, "[]", "[crew]", "[superadmin]"]) {
        const res = await api(exportGrid(groups));

        expect(res.statusCode).toBe(403);
        expect(res.isBase64Encoded).toBeUndefined();
        expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
      }
    });

    it("lets an admin export the casting grid", async () => {
      const { api } = setUp();

      const res = await api(exportGrid("[crew admin]"));

      expect(res.statusCode).toBe(200);
      expect(res.isBase64Encoded).toBe(true);
      expect(res.headers?.["cache-control"]).toBe("no-store");
    });

    it("lets an admin delete a cast member", async () => {
      const { api, cast } = setUp();

      const res = await api(deleteAlex("[admin]"));

      expect(res.statusCode).toBe(204);
      expect((await cast.list("2027"))?.members).toEqual([]);
    });

    it("lets an admin save a running-order version, whatever other groups they're in", async () => {
      const { api, runningOrders } = setUp();

      const res = await api(saveVersion("[crew admin]"));

      expect(res.statusCode).toBe(201);
      expect((await runningOrders.latest("2027"))?.version).toBe(5);
    });

    it("lets a non-admin make every other change, such as adding a cast member", async () => {
      const { api, cast } = setUp();

      const res = await api(
        signedIn("POST", "/api/productions/2027/cast", "[crew]", {
          body: JSON.stringify({ firstName: "Jo", lastName: "Sample", section: null, group: "" }),
        }),
      );

      expect(res.statusCode).toBe(201);
      expect((await cast.list("2027"))?.members).toContainEqual(
        expect.objectContaining({ firstName: "Jo", lastName: "Sample" }),
      );
    });
  });
});
