import { CastList, HealthResponse, ItemNoteList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import type { Handler } from "./handler.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { handler, lambdaEntry } from "./lambda.ts";
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

    expect(res).toEqual({ statusCode: 404 });
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
});
