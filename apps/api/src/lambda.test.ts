import {
  adminOnlyRouteKeys,
  CastList,
  HealthResponse,
  ItemNoteList,
  LOCAL_ACCESS_HEADER,
  needOf,
  Role,
  readOnlyMayUse,
  refusalFor,
  routeKeys,
  UsageSummary,
} from "@app/shared";
import { describe, expect, it, vi } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import type { Handler } from "./handler.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { handler } from "./lambda.ts";
import { lambdaEntry } from "./lambda-entry.ts";
import { inMemoryPropStore } from "./prop-store.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { createRoutes } from "./routes.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { inMemoryUsageStore } from "./usage-store.ts";

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

    // As an admin: a route missing from the shared table is admins' only (ADR 0026).
    const res = await entry(
      request(
        "PUT",
        "/api/things/a%20b",
        { queryStringParameters: { q: "1" }, body: '{"name":"x"}' },
        "[admin]",
      ),
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
      request(
        "POST",
        "/api/things",
        { body: Buffer.from('{"name":"x"}').toString("base64"), isBase64Encoded: true },
        "[admin]",
      ),
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
        createRoutes(
          {
            cast,
            roles,
            runningOrders: inMemoryRunningOrderStore([
              aRunningOrder(3, { first: ["Pirate Sketch"] }),
            ]),
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
        ),
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
        createRoutes(
          {
            cast,
            roles,
            runningOrders,
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
        ),
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

    it.each([
      ["an admin", "[crew admin]"],
      ["a Casting Team Member", "[casting]"],
      ["a Read-Only Team Member", "[read-only]"],
      ["someone in no known group", "[crew]"],
    ])("lets %s export the casting grid (ADR 0021)", async (_who, groups) => {
      const { api } = setUp();

      const res = await api(exportGrid(groups));

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
    const READ_ONLY = { message: "You can view the casting, but not change it." };
    const setUp = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1)])]);
      const roles = inMemoryRoleStore();
      const itemNotes = inMemoryItemNoteStore();
      const runningOrders = inMemoryRunningOrderStore([
        aRunningOrder(4, { first: ["Pirate Sketch"] }),
      ]);
      const api = lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders,
            itemNotes,
            props: inMemoryPropStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
        ),
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

      const responses = [];
      for (const change of changes) responses.push(await api(change));

      expect(responses.map((res) => res.statusCode)).toEqual([403, 403, 403, 403]);
      // Saving a running-order version is admin-only, so it says so (ADR 0026).
      expect(responses.map((res) => JSON.parse(res.body ?? ""))).toEqual([
        READ_ONLY,
        READ_ONLY,
        READ_ONLY,
        { message: "Only admins can do this." },
      ]);
      expect((await cast.list("2027"))?.members).toHaveLength(1);
      expect((await itemNotes.list("2027")).notes).toEqual([]);
      expect((await roles.list("2027")).roles).toEqual([]);
      expect((await runningOrders.latest("2027"))?.version).toBe(4);
    });

    it("refuses every route a read-only member may not use before its handler runs, and lets the rest through", async () => {
      const handler = vi.fn(async () => ({ statusCode: 200 }));
      const api = lambdaEntry(Object.fromEntries(routeKeys.map((key) => [key, handler])));

      for (const key of routeKeys) {
        handler.mockClear();
        const [method = "", path = ""] = key.split(" ");
        const res = await api(asReadOnly(method, path.replaceAll(/\{\w+\}/g, "x")));

        if (readOnlyMayUse(key) && !adminOnlyRouteKeys.includes(key)) {
          expect(handler, key).toHaveBeenCalledOnce();
        } else if (readOnlyMayUse(key)) {
          // Listing accounts, or reading usage, is a read, but still admins' only.
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

    it("ignores a request choosing access the way the local switch does, using only the token's", async () => {
      const { api, cast } = setUp();
      const choosingAdmin = { headers: { [LOCAL_ACCESS_HEADER]: "admin" } };

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

  describe("department permissions (ADR 0026)", () => {
    const READ_ONLY = { message: "You can view the casting, but not change it." };
    const ONLY_ADMINS = { message: "Only admins can do this." };
    const pirate = itemId("Pirate Sketch");
    const setUp = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1)])]);
      const roles = inMemoryRoleStore();
      const itemNotes = inMemoryItemNoteStore();
      const runningOrders = inMemoryRunningOrderStore([
        aRunningOrder(4, { first: ["Pirate Sketch"] }),
      ]);
      const api = lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders,
            itemNotes,
            props: inMemoryPropStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
        ),
      );
      // What the stores hold, to show a refused change changed nothing.
      const stored = async () => ({
        cast: await cast.list("2027"),
        roles: await roles.list("2027"),
        notes: await itemNotes.list("2027"),
        version: (await runningOrders.latest("2027"))?.version,
      });
      return { api, stored };
    };
    const as = (groups: string) => (method: string, rawPath: string, body?: unknown) =>
      request(method, rawPath, body === undefined ? {} : { body: JSON.stringify(body) }, groups);
    // Casting changes: adding a cast member, adding a role, saving item notes.
    const castingChanges = (send: ReturnType<typeof as>) => [
      send("POST", "/api/productions/2027/cast", {
        firstName: "Jo",
        lastName: "Sample",
        section: null,
        group: "",
      }),
      send("POST", `/api/productions/2027/items/${pirate}/roles`, {
        name: "Captain",
        size: "lead",
        castMemberIds: [],
      }),
      send("PUT", `/api/productions/2027/items/${pirate}/notes`, { revision: 0, text: "Hats" }),
    ];
    // Every route, each with a stand-in handler, to see which reach it.
    const everyRoute = () => {
      const reached = vi.fn(async () => ({ statusCode: 200 }));
      const api = lambdaEntry(Object.fromEntries(routeKeys.map((key) => [key, reached])));
      const send = async (key: string, groups: string) => {
        reached.mockClear();
        const [method = "", path = ""] = key.split(" ");
        const res = await api(request(method, path.replaceAll(/\{\w+\}/g, "x"), {}, groups));
        return { res, ran: reached.mock.calls.length > 0 };
      };
      return send;
    };
    const changeRoutes = routeKeys.filter((key) => !readOnlyMayUse(key));

    it("saves sam's casting changes with Casting only, and still keeps admin-only ones for admins", async () => {
      const { api } = setUp();
      const sam = as("[casting]");

      const saved = [];
      for (const change of castingChanges(sam)) saved.push(await api(change));
      const { firstName, lastName, section, group, revision } = aCastMember(1);
      const edited = await api(
        sam("PUT", "/api/productions/2027/cast/1", {
          firstName: `${firstName}-edited`,
          lastName,
          section,
          group,
          revision,
        }),
      );
      const added = Role.parse(JSON.parse(saved[1]?.body ?? ""));
      const roleEdited = await api(
        sam("PUT", `/api/productions/2027/roles/${added.id}`, {
          name: "First Mate",
          size: "lead",
          castMemberIds: [],
          revision: added.revision,
        }),
      );
      const send = everyRoute();

      expect(saved.map((res) => res.statusCode)).toEqual([201, 201, 200]);
      expect(edited.statusCode).toBe(200);
      expect(roleEdited.statusCode).toBe(200);
      for (const key of adminOnlyRouteKeys) {
        const { res, ran } = await send(key, "[casting]");
        expect(JSON.parse(res.body ?? ""), key).toEqual(ONLY_ADMINS);
        expect(ran, key).toBe(false);
      }
    });

    it("refuses pat's casting changes with Stage only, saying read-only and changing nothing", async () => {
      const { api, stored } = setUp();
      const before = await stored();

      for (const change of castingChanges(as("[stage]"))) {
        const res = await api(change);

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
      }
      expect(await stored()).toEqual(before);
    });

    it("refuses a route missing from the table for everyone but admins, before its handler runs", async () => {
      const reached = vi.fn(async () => ({ statusCode: 200 }));
      const api = lambdaEntry({ "PUT /api/things/{thingId}": reached });

      for (const groups of ["[casting stage tech costume]", "[]"]) {
        const res = await api(request("PUT", "/api/things/1", {}, groups));
        expect(res.statusCode, groups).toBe(403);
      }
      expect(reached).not.toHaveBeenCalled();
      expect((await api(request("PUT", "/api/things/1", {}, "[admin]"))).statusCode).toBe(200);
    });

    it("lets jo, with no permissions, read what Casting reads, and refuses jo's changes", async () => {
      const { api, stored } = setUp();
      await api(
        as("[casting]")("PUT", `/api/productions/2027/items/${pirate}/notes`, {
          revision: 0,
          text: "Hats",
        }),
      );
      const before = await stored();

      for (const path of ["running-order", "cast", "roles", "item-notes"]) {
        const asJo = await api(as("[]")("GET", `/api/productions/2027/${path}`));
        const asCasting = await api(as("[casting]")("GET", `/api/productions/2027/${path}`));

        expect(asJo.statusCode, path).toBe(200);
        expect(asJo.body, path).toEqual(asCasting.body);
      }
      for (const change of castingChanges(as("[]"))) {
        const res = await api(change);
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
      }
      const send = everyRoute();
      for (const key of changeRoutes) {
        const { res, ran } = await send(key, "[]");
        expect([res.statusCode, ran], key).toEqual([403, false]);
      }
      expect(await stored()).toEqual(before);
    });

    it("lets kim, with Casting and Stage, make casting changes as with Casting only, and Stage's as with Stage only", async () => {
      const { api } = setUp();
      const send = everyRoute();

      const saved = [];
      for (const change of castingChanges(as("[casting stage]"))) {
        saved.push((await api(change)).statusCode);
      }

      expect(saved).toEqual([201, 201, 200]);
      for (const key of changeRoutes) {
        const kim = await send(key, "[casting stage]");
        const alone = await send(key, needOf(key) === "stage" ? "[stage]" : "[casting]");
        expect(kim, key).toEqual(alone);
      }
    });

    it("refuses every change from lee, with Tech and Costume only, saying what is read-only, or admins' only for admin-only ones", async () => {
      const send = everyRoute();

      for (const key of changeRoutes) {
        const { res, ran } = await send(key, "[tech costume]");

        expect(res.statusCode, key).toBe(403);
        const need = needOf(key);
        expect(JSON.parse(res.body ?? ""), key).toEqual(
          need === undefined || need === "admin" ? ONLY_ADMINS : { message: refusalFor(need) },
        );
        expect(ran, key).toBe(false);
      }
    });

    it("lets alex, an admin, use every route, admin-only ones included", async () => {
      const send = everyRoute();

      for (const key of routeKeys) {
        const { res, ran } = await send(key, "[admin]");
        expect([res.statusCode, ran], key).toEqual([200, true]);
      }
    });

    it("lets pat, with Stage only, export the casting grid and record a page visit", async () => {
      const { api } = setUp();
      const pat = as("[stage]");

      const exported = await api(
        pat("POST", "/api/productions/2027/casting-grid/export", {
          items: [{ heading: "1.1 · Opening Number", printed: true }],
          rows: [{ firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["L"] }],
        }),
      );
      const visited = await api({
        rawPath: "/api/usage",
        requestContext: {
          http: { method: "POST" },
          authorizer: { jwt: { claims: { username: "pat", "cognito:groups": "[stage]" } } },
        },
        body: JSON.stringify({ event: "session" }),
      });

      expect(exported.statusCode).toBe(200);
      expect(visited.statusCode).toBe(204);
    });

    describe("adding a prop, which needs Stage", () => {
      const PROPS_READ_ONLY = { message: "You can view the props, but not change them." };
      const setUpProps = () => {
        const cast = inMemoryCastStore();
        const roles = inMemoryRoleStore();
        const props = inMemoryPropStore();
        const api = lambdaEntry(
          createRoutes(
            {
              cast,
              roles,
              runningOrders: inMemoryRunningOrderStore([
                aRunningOrder(4, { first: ["Pirate Sketch"] }),
              ]),
              itemNotes: inMemoryItemNoteStore(),
              props,
              removeCastMember: uncastThenRemove(cast, roles),
            },
            inMemoryUsageStore(),
          ),
        );
        return { api, props };
      };
      const addProp = (groups: string, name: string) =>
        as(groups)("POST", `/api/productions/2027/items/${pirate}/props`, { name });

      it.each([
        ["pat, with Stage", "[stage]", "Treasure chest"],
        ["alex, an admin", "[admin]", "Parrot"],
      ])("saves a prop from %s", async (_who, groups, name) => {
        const { api, props } = setUpProps();

        const res = await api(addProp(groups, name));

        expect(res.statusCode).toBe(201);
        expect((await props.list("2027")).props).toEqual([{ id: 1, itemId: pirate, name }]);
      });

      it.each([
        ["sam, with Casting only", "[casting]"],
        ["lee, with Tech and Costume", "[tech costume]"],
      ])(
        "refuses a prop from %s, saying the props are read-only, adding nothing",
        async (_who, groups) => {
          const { api, props } = setUpProps();

          const res = await api(addProp(groups, "Treasure chest"));

          expect(res.statusCode).toBe(403);
          expect(JSON.parse(res.body ?? "")).toEqual(PROPS_READ_ONLY);
          expect((await props.list("2027")).props).toEqual([]);
        },
      );
    });

    it.each(["[props]", "[crew Stage CASTING]", "[superadmin]"])(
      "refuses a change from a sign-in whose groups are only unknown ones, %s, saying read-only",
      async (groups) => {
        const { api, stored } = setUp();
        const before = await stored();

        for (const change of castingChanges(as(groups))) {
          const res = await api(change);
          expect(res.statusCode).toBe(403);
          expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
        }
        expect(await stored()).toEqual(before);
      },
    );
  });

  describe("usage (ADR 0023)", () => {
    const setUp = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1)])]);
      const roles = inMemoryRoleStore();
      return lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders: inMemoryRunningOrderStore([aRunningOrder(3)]),
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
        ),
      );
    };
    const signedInAs = (username: string, groups: string, method: string, body?: unknown) => ({
      rawPath: "/api/usage",
      requestContext: {
        http: { method },
        authorizer: { jwt: { claims: { username, "cognito:groups": groups } } },
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const usageSeenByAdmin = async (api: ReturnType<typeof setUp>) => {
      const res = await api(signedInAs("alex", "[admin]", "GET"));
      expect(res.statusCode).toBe(200);
      return UsageSummary.parse(JSON.parse(res.body ?? "")).people;
    };

    it("records a read-only member's session, though they can change nothing else", async () => {
      const api = setUp();

      const res = await api(signedInAs("sky", "[read-only]", "POST", { event: "session" }));

      expect(res.statusCode).toBe(204);
      expect((await usageSeenByAdmin(api)).map((person) => person.username)).toEqual(["sky"]);
    });

    it("records the session for the account signed in, not one the request names", async () => {
      const api = setUp();

      await api(signedInAs("robin", "[casting]", "POST", { event: "session", username: "alex" }));

      expect((await usageSeenByAdmin(api)).map((person) => person.username)).toEqual(["robin"]);
    });

    it.each([
      ["a Casting Team Member", "[casting]"],
      ["a Read-Only Team Member", "[read-only]"],
    ])("refuses usage to %s, sending none of it", async (_who, groups) => {
      const api = setUp();
      await api(signedInAs("robin", "[casting]", "POST", { event: "session" }));

      const res = await api(signedInAs("sky", groups, "GET"));

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
    });
  });
});
