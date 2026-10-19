import {
  adminOnlyRouteKeys,
  CastList,
  HealthResponse,
  ItemNoteList,
  isReadRoute,
  LOCAL_ROLE_HEADER,
  routeKeys,
} from "@app/shared";
import { describe, expect, it, vi } from "vitest";
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

// The parts of an API Gateway HTTP API (payload v2) event that the entry point reads, signed
// in as a Casting Team Member unless a test says otherwise.
const request = (method: string, rawPath: string, extra = {}, groups = "[casting]") => ({
  rawPath,
  requestContext: {
    http: { method },
    authorizer: { jwt: { claims: { sub: "made-up", "cognito:groups": groups } } },
  },
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

      for (const groups of ["[casting]", "[crew casting]"]) {
        const res = await api(deleteAlex(groups));

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
      }
      expect((await cast.list("2027"))?.members).toEqual([alex]);
    });

    it("refuses a non-admin's draft that adds or removes an item, keeping the latest", async () => {
      const { api, runningOrders } = setUp();
      const { id: _id, ...encore } = { ...aRunningOrder(4).halves[0].items[0], title: "Encore" };
      const removeAll = {
        type: "update",
        halves: aRunningOrder(4).halves.map(({ id }) => ({ id, items: [] })),
      };
      const addEncore = {
        type: "update",
        halves: aRunningOrder(4).halves.map(({ id, items }) => ({ id, items: [...items, encore] })),
      };

      for (const change of [removeAll, addEncore]) {
        const res = await api(
          signedIn("POST", "/api/productions/2027/running-order/versions", "[casting]", {
            body: JSON.stringify({ baseVersion: 4, change }),
          }),
        );

        expect(res.statusCode).toBe(403);
      }
      expect((await runningOrders.latest("2027"))?.version).toBe(4);
    });

    it("refuses a non-admin's new running-order version, keeping the latest", async () => {
      const { api, runningOrders } = setUp();

      const res = await api(saveVersion("[casting]"));

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

      for (const groups of ["[casting]", "[crew casting]"]) {
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

    it("lets a Casting Team Member make every other change, such as adding a cast member", async () => {
      const { api, cast } = setUp();

      const res = await api(
        signedIn("POST", "/api/productions/2027/cast", "[casting]", {
          body: JSON.stringify({ firstName: "Jo", lastName: "Sample", section: null, group: "" }),
        }),
      );

      expect(res.statusCode).toBe(201);
      expect((await cast.list("2027"))?.members).toContainEqual(
        expect.objectContaining({ firstName: "Jo", lastName: "Sample" }),
      );
    });
  });

  describe("read-only members (ADR 0020)", () => {
    const READ_ONLY = { message: "You have read-only access." };
    const setUp = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1)])]);
      const roles = inMemoryRoleStore();
      const itemNotes = inMemoryItemNoteStore();
      const runningOrders = inMemoryRunningOrderStore([
        aRunningOrder(4, { first: ["Pirate Sketch"] }),
      ]);
      const api = lambdaEntry(
        createRoutes({
          cast,
          roles,
          runningOrders,
          itemNotes,
          removeCastMember: uncastThenRemove(cast, roles),
        }),
      );
      return { api, cast, roles, itemNotes, runningOrders };
    };
    const asReadOnly = (method: string, rawPath: string, body?: unknown) =>
      request(
        method,
        rawPath,
        body === undefined ? {} : { body: JSON.stringify(body) },
        "[read-only]",
      );
    const pirate = itemId("Pirate Sketch");

    it("lets a read-only member read the running order, cast, roles and item notes", async () => {
      const { api } = setUp();
      await api(
        request("PUT", `/api/productions/2027/items/${pirate}/notes`, {
          body: JSON.stringify({ revision: 0, text: "Hat change" }),
        }),
      );

      for (const path of ["running-order", "cast", "roles", "item-notes"]) {
        const asReader = await api(asReadOnly("GET", `/api/productions/2027/${path}`));
        const asCasting = await api(request("GET", `/api/productions/2027/${path}`));

        expect(asReader.statusCode, path).toBe(200);
        expect(asReader.body, path).toEqual(asCasting.body);
      }
    });

    it("lets a Casting Team Member save item notes and add a role", async () => {
      const { api, roles, itemNotes } = setUp();

      const notes = await api(
        request("PUT", `/api/productions/2027/items/${pirate}/notes`, {
          body: JSON.stringify({ revision: 0, text: "Hat change" }),
        }),
      );
      const role = await api(
        request("POST", `/api/productions/2027/items/${pirate}/roles`, {
          body: JSON.stringify({ name: "Captain", size: "lead", castMemberIds: [] }),
        }),
      );

      expect([notes.statusCode, role.statusCode]).toEqual([200, 201]);
      expect((await itemNotes.list("2027")).notes[0]?.text).toBe("Hat change");
      expect((await roles.list("2027")).roles.map((r) => r.name)).toEqual(["Captain"]);
    });

    it("refuses a read-only member's changes, saying why and changing nothing", async () => {
      const { api, cast, roles, itemNotes, runningOrders } = setUp();
      const changes = [
        asReadOnly("POST", "/api/productions/2027/cast", {
          firstName: "Jo",
          lastName: "Sample",
          section: null,
          group: "",
        }),
        asReadOnly("PUT", `/api/productions/2027/items/${pirate}/notes`, {
          revision: 0,
          text: "x",
        }),
        asReadOnly("POST", `/api/productions/2027/items/${pirate}/roles`, {
          name: "Captain",
          size: "lead",
          castMemberIds: [],
        }),
        asReadOnly("POST", "/api/productions/2027/running-order/versions", {
          baseVersion: 4,
          change: {
            type: "update",
            halves: aRunningOrder(4, { first: ["Pirate Sketch"] }).halves.map(({ id, items }) => ({
              id,
              items,
            })),
          },
        }),
      ];

      for (const change of changes) {
        const res = await api(change);

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
      }
      expect((await cast.list("2027"))?.members).toHaveLength(1);
      expect((await itemNotes.list("2027")).notes).toEqual([]);
      expect((await roles.list("2027")).roles).toEqual([]);
      expect((await runningOrders.latest("2027"))?.version).toBe(4);
    });

    it("refuses every route that isn't a read before its handler runs, and lets every read through", async () => {
      const handler = vi.fn(async () => ({ statusCode: 200 }));
      const api = lambdaEntry(Object.fromEntries(routeKeys.map((key) => [key, handler])));

      for (const key of routeKeys) {
        handler.mockClear();
        const [method = "", path = ""] = key.split(" ");
        const res = await api(asReadOnly(method, path.replaceAll(/\{\w+\}/g, "x")));

        if (isReadRoute(key) && !adminOnlyRouteKeys.includes(key)) {
          expect(handler, key).toHaveBeenCalledOnce();
        } else if (isReadRoute(key)) {
          // Listing accounts is a read, but still admins' only.
          expect(JSON.parse(res.body ?? ""), key).toEqual({ message: "Only admins can do this." });
        } else {
          expect(res.statusCode, key).toBe(403);
          expect(handler, key).not.toHaveBeenCalled();
        }
      }
    });

    it.each([undefined, "[]", "[crew]", "[superadmin]", "[Casting]", "[crew,casting]"])(
      "treats an account whose groups are %s as read-only",
      async (groups) => {
        const { api, cast } = setUp();
        const event = {
          rawPath: "/api/productions/2027/cast",
          requestContext: {
            http: { method: "POST" },
            authorizer: {
              jwt: { claims: { sub: "made-up", ...(groups ? { "cognito:groups": groups } : {}) } },
            },
          },
          body: JSON.stringify({ firstName: "Jo", lastName: "Sample", section: null, group: "" }),
        };

        const res = await api(event);

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
        expect((await cast.list("2027"))?.members).toHaveLength(1);
      },
    );

    it("lets an admin make changes, admin-only ones included", async () => {
      const { api, cast } = setUp();
      const admin = (method: string, rawPath: string, extra = {}) =>
        request(method, rawPath, extra, "[admin]");

      const added = await api(
        admin("POST", "/api/productions/2027/cast", {
          body: JSON.stringify({ firstName: "Jo", lastName: "Sample", section: null, group: "" }),
        }),
      );
      const deleted = await api(
        admin("DELETE", "/api/productions/2027/cast/1", {
          queryStringParameters: { revision: "1" },
        }),
      );

      expect([added.statusCode, deleted.statusCode]).toEqual([201, 204]);
      expect((await cast.list("2027"))?.members.map((m) => m.firstName)).toEqual(["Jo"]);
    });

    it("ignores a request choosing a role the way the local switch does, using only the token's", async () => {
      const { api, cast } = setUp();
      const choosingAdmin = { headers: { [LOCAL_ROLE_HEADER]: "admin" } };

      const added = await api(
        request(
          "POST",
          "/api/productions/2027/cast",
          {
            ...choosingAdmin,
            body: JSON.stringify({ firstName: "Jo", lastName: "Sample", section: null, group: "" }),
          },
          "[read-only]",
        ),
      );
      const deleted = await api(
        request(
          "DELETE",
          "/api/productions/2027/cast/1",
          { ...choosingAdmin, queryStringParameters: { revision: "1" } },
          "[casting]",
        ),
      );

      expect([added.statusCode, deleted.statusCode]).toEqual([403, 403]);
      expect((await cast.list("2027"))?.members).toHaveLength(1);
    });
  });
});
