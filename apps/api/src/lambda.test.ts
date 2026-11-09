import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  adminOnlyRouteKeys,
  CastList,
  HealthResponse,
  ItemFileCounts,
  ItemFileLink,
  ItemFileList,
  ItemNoteList,
  LOCAL_ACCESS_HEADER,
  MicPlotList,
  needOf,
  Role,
  readOnlyMayUse,
  readOnlyRefusal,
  routeKeys,
  UsageSummary,
} from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import type { Handler } from "#/http/handler.ts";
import { lambdaEntry } from "#/http/lambda-entry.ts";
import { inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import {
  folderItemFileStore,
  type ItemFileStore,
} from "#/production/item-files/item-file-store.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore } from "#/production/props/prop-store.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { aCastList, aCastMember } from "#/show/cast/cast.fixture.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { uncastThenRemove } from "#/show/cast/remove-cast-member.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { handler } from "./lambda.ts";
import { createRoutes } from "./routes.ts";

const noSceneryFiles: ItemFileStore = {
  list: async () => [],
  linkTo: async () => undefined,
  remove: async () => "gone",
  uploadTo: async () => "taken",
  countByItem: async () => ({}),
  keepOnlyItems: async () => {},
};

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
    const entry = lambdaEntry({ "PUT /api/things/{thingId}": echo }, inMemoryProductionListStore());

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
    const entry = lambdaEntry({ "POST /api/things": echo }, inMemoryProductionListStore());

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
    const entry = (sceneryFiles = noSceneryFiles) => {
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
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: sceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
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

    it.each([
      ["no permissions", "[]"],
      ["admin", "[admin]"],
    ])("lists an item's scenery files for an account with %s", async (_, groups) => {
      const setPlan = { name: "set-plan.pdf", size: 2_400_000 };
      const api = entry({ ...noSceneryFiles, list: async () => [setPlan] });

      const res = await api(
        request("GET", "/api/productions/2027/items/opening-number/scenery-files", {}, groups),
      );

      expect(res.statusCode).toBe(200);
      expect(ItemFileList.parse(JSON.parse(res.body ?? ""))).toEqual({ files: [setPlan] });
    });

    it.each([
      ["Casting only", "[casting]"],
      ["no permissions", "[]"],
    ])("counts each item's scenery files for an account with %s", async (_, groups) => {
      const api = entry({ ...noSceneryFiles, countByItem: async () => ({ "opening-number": 9 }) });

      const res = await api(
        request("GET", "/api/productions/2027/scenery-file-counts", {}, groups),
      );

      expect(res.statusCode).toBe(200);
      expect(ItemFileCounts.parse(JSON.parse(res.body ?? ""))).toEqual({
        counts: { "opening-number": 9 },
      });
    });

    it.each([
      ["no permissions", "[]"],
      ["admin", "[admin]"],
    ])("links to an item's scenery file for an account with %s", async (_, groups) => {
      const url = "https://files.example/2027/opening-number/scenery/set-plan.pdf?signed";
      const api = entry({
        ...noSceneryFiles,
        linkTo: async (_production, item, name) =>
          item === "opening-number" && name === "set-plan.pdf" ? url : undefined,
      });

      const res = await api(
        request(
          "GET",
          "/api/productions/2027/items/opening-number/scenery-file-link",
          { queryStringParameters: { name: "set-plan.pdf" } },
          groups,
        ),
      );

      expect(res.statusCode).toBe(200);
      expect(ItemFileLink.parse(JSON.parse(res.body ?? ""))).toEqual({ url });
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
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
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
    const READ_ONLY = {
      message: "You can view the casting, but not change it.",
      department: "casting",
    };
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
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
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
      const api = lambdaEntry(
        Object.fromEntries(routeKeys.map((key) => [key, handler])),
        inMemoryProductionListStore(),
      );

      for (const key of routeKeys) {
        handler.mockClear();
        const [method = "", path = ""] = key.split(" ");
        const res = await api(
          asReadOnly(method, path.replace("{productionId}", "2027").replaceAll(/\{\w+\}/g, "x")),
        );

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
    const READ_ONLY = {
      message: "You can view the casting, but not change it.",
      department: "casting",
    };
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
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
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
      const api = lambdaEntry(
        Object.fromEntries(routeKeys.map((key) => [key, reached])),
        inMemoryProductionListStore(),
      );
      const send = async (key: string, groups: string) => {
        reached.mockClear();
        const [method = "", path = ""] = key.split(" ");
        const res = await api(
          request(
            method,
            path.replace("{productionId}", "2027").replaceAll(/\{\w+\}/g, "x"),
            {},
            groups,
          ),
        );
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
      const api = lambdaEntry(
        { "PUT /api/things/{thingId}": reached },
        inMemoryProductionListStore(),
      );

      for (const groups of ["[casting stage tech wardrobe]", "[]"]) {
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

    it.each([
      [
        "PUT /api/productions/{productionId}/items/{itemId}/notes",
        "casting",
        "You can view the casting, but not change it.",
      ],
      [
        "PUT /api/productions/{productionId}/items/{itemId}/props-notes",
        "props",
        "You can view the props, but not change them.",
      ],
      [
        "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes",
        "scenery",
        "You can view the scenery, but not change it.",
      ],
      [
        "PUT /api/productions/{productionId}/items/{itemId}/sfx-notes",
        "sfx",
        "You can view the SFX, but not change them.",
      ],
      [
        "PUT /api/productions/{productionId}/items/{itemId}/mic-plot-notes",
        "mic-plot",
        "You can view the mic plot, but not change it.",
      ],
      [
        "PUT /api/productions/{productionId}/items/{itemId}/wardrobe-notes",
        "wardrobe",
        "You can view the wardrobe, but not change it.",
      ],
    ] as const)(
      "refuses pat's %s, with no permissions, naming the %s department in its own words",
      async (key, department, message) => {
        const { res, ran } = await everyRoute()(key, "[]");

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({ message, department });
        expect(ran).toBe(false);
      },
    );

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
        const stages = needOf(key) === "props" || needOf(key) === "scenery";
        const alone = await send(key, stages ? "[stage]" : "[casting]");
        expect(kim, key).toEqual(alone);
      }
    });

    it.each([
      ["lee, with Tech and Wardrobe only", "[tech wardrobe]"],
      ["chris, with Wardrobe only", "[wardrobe]"],
    ])(
      "refuses every change from %s but Tech's scenery, SFX and mic plot changes and Wardrobe's own, saying what is read-only, or admins' only for admin-only ones",
      async (_who, groups) => {
        const send = everyRoute();
        const techMay = (key: string) =>
          groups.includes("tech") &&
          ["scenery", "sfx", "mic-plot"].some((need) => need === needOf(key));
        const wardrobeMay = (key: string) =>
          groups.includes("wardrobe") && needOf(key) === "wardrobe";

        for (const key of changeRoutes.filter((key) => !techMay(key) && !wardrobeMay(key))) {
          const { res, ran } = await send(key, groups);

          expect(res.statusCode, key).toBe(403);
          const need = needOf(key);
          expect(JSON.parse(res.body ?? ""), key).toEqual(
            need === undefined || need === "admin" ? ONLY_ADMINS : readOnlyRefusal(need),
          );
          expect(ran, key).toBe(false);
        }
      },
    );

    it("refuses every change from a sign-in still carrying the old Costume group, as for no permissions", async () => {
      const send = everyRoute();

      for (const key of changeRoutes) {
        expect(await send(key, "[costume]"), key).toEqual(await send(key, "[]"));
      }
    });

    describe("Director (ADR 0029)", () => {
      // Casting someone: a role with a cast member in it.
      const castSomeone = (send: ReturnType<typeof as>) =>
        send("POST", `/api/productions/2027/items/${pirate}/roles`, {
          name: "Captain",
          size: "lead",
          castMemberIds: [1],
        });

      it("refuses dee's casting changes with Director only, saying the casting is read-only and changing nothing", async () => {
        const { api, stored } = setUp();
        const before = await stored();
        const dee = as("[director]");

        for (const change of [...castingChanges(dee), castSomeone(dee)]) {
          const res = await api(change);

          expect(res.statusCode).toBe(403);
          expect(JSON.parse(res.body ?? "")).toEqual(READ_ONLY);
        }
        expect(await stored()).toEqual(before);
      });

      it("refuses dee's running order and every other admin-only change, saying only admins can", async () => {
        const { api, stored } = setUp();
        const before = await stored();
        const send = everyRoute();

        const saved = await api(
          as("[director]")("POST", "/api/productions/2027/running-order/versions", {
            baseVersion: 4,
            change: { type: "update", halves: aRunningOrder(4).halves },
          }),
        );

        expect(saved.statusCode).toBe(403);
        expect(JSON.parse(saved.body ?? "")).toEqual(ONLY_ADMINS);
        expect(await stored()).toEqual(before);
        for (const key of adminOnlyRouteKeys) {
          const { res, ran } = await send(key, "[director]");
          expect(JSON.parse(res.body ?? ""), key).toEqual(ONLY_ADMINS);
          expect(ran, key).toBe(false);
        }
      });

      it("lets dee, with Director only, use exactly the props, scenery, SFX, mic plot and Wardrobe changes", async () => {
        const send = everyRoute();

        for (const key of changeRoutes) {
          const { ran } = await send(key, "[director]");
          const production = ["props", "scenery", "sfx", "mic-plot", "wardrobe"];
          expect(ran, key).toBe(production.some((need) => needOf(key) === need));
        }
      });

      it("saves kim's casting and props changes, with Casting and Director", async () => {
        const { api } = setUp();
        const kim = as("[casting director]");

        const cast = await api(castSomeone(kim));
        const prop = await api(
          kim("POST", `/api/productions/2027/items/${pirate}/props`, { name: "Cutlass" }),
        );

        expect([cast.statusCode, prop.statusCode]).toEqual([201, 201]);
      });

      it("lets an admin whose sign-in also carries Director use every route, as any admin", async () => {
        const send = everyRoute();

        for (const key of routeKeys) {
          expect(await send(key, "[admin director]"), key).toEqual(await send(key, "[admin]"));
        }
      });
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
      const PROPS_READ_ONLY = {
        message: "You can view the props, but not change them.",
        department: "props",
      };
      const setUpProps = (years?: string[]) => {
        const productions = inMemoryProductionListStore(years);
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
                aRunningOrder(1, { first: ["Pirate Sketch"], productionId: "2028" }),
              ]),
              itemNotes: inMemoryItemNoteStore(),
              props,
              propsNotes: inMemoryItemNoteStore(),
              sceneryNotes: inMemoryItemNoteStore(),
              sfxNotes: inMemoryItemNoteStore(),
              wardrobeNotes: inMemoryItemNoteStore(),
              micPlotNotes: inMemoryItemNoteStore(),
              micPlots: inMemoryMicPlotStore(),
              productions,
              removeCastMember: uncastThenRemove(cast, roles),
            },
            inMemoryUsageStore(),
            { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
          ),
          productions,
        );
        return { api, props };
      };
      const addProp = (groups: string, name: string) =>
        as(groups)("POST", `/api/productions/2027/items/${pirate}/props`, { name });

      it.each([
        ["pat, with Stage", "[stage]", "Treasure chest"],
        ["dee, with Director", "[director]", "Cutlass"],
        ["alex, an admin", "[admin]", "Parrot"],
      ])("saves a prop from %s", async (_who, groups, name) => {
        const { api, props } = setUpProps();

        const res = await api(addProp(groups, name));

        expect(res.statusCode).toBe(201);
        expect((await props.list("2027")).props).toEqual([
          { id: 1, itemId: pirate, name, quantity: 1, roleIds: [], carrierIds: [] },
        ]);
      });

      it.each([
        ["sam, with Casting only", "[casting]"],
        ["lee, with Tech and Wardrobe", "[tech wardrobe]"],
        ["lee, with Casting, Tech and Wardrobe", "[casting tech wardrobe]"],
        ["chris, with Wardrobe only", "[wardrobe]"],
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

      it("gives pat, with Stage, the same access in another production", async () => {
        const { api, props } = setUpProps(["2027", "2028"]);
        const pat = as("[stage]");
        const inNext = "/api/productions/2028";

        const added = await api(
          pat("POST", `${inNext}/items/${pirate}/props`, { name: "Treasure chest" }),
        );
        const noted = await api(
          pat("PUT", `${inNext}/items/${pirate}/scenery-notes`, { text: "Mast up", revision: 0 }),
        );
        const viewed = await api(pat("GET", `${inNext}/roles`));
        const cast = await api(
          pat("POST", `${inNext}/cast`, {
            firstName: "Made",
            lastName: "Up",
            section: "Scouts",
            group: "1st Example",
            ageBand: "under-14",
          }),
        );

        expect(added.statusCode).toBe(201);
        expect((await props.list("2028")).props.map(({ name }) => name)).toEqual([
          "Treasure chest",
        ]);
        expect(noted.statusCode).toBe(200);
        expect(viewed.statusCode).toBe(200);
        expect(cast.statusCode).toBe(403);
      });

      it("keeps pat's Stage access for the new production once it starts, with the old one view only", async () => {
        const { api, props } = setUpProps();
        const started = await api(as("[admin]")("POST", "/api/productions", { year: "2028" }));
        const addTo = (year: string) =>
          api(
            as("[stage]")("POST", `/api/productions/${year}/items/${pirate}/props`, {
              name: "Treasure chest",
            }),
          );

        expect(started.statusCode).toBe(201);
        expect((await addTo("2027")).statusCode).toBe(403);
        expect((await addTo("2028")).statusCode).toBe(201);
        expect((await props.list("2028")).props).toHaveLength(1);
      });

      it("lets an admin delete a past production, though past productions are closed to changes", async () => {
        const { api } = setUpProps(["2027", "2028"]);

        const res = await api(as("[admin]")("DELETE", "/api/productions/2027"));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body ?? "")).toEqual({ productions: ["2028"] });
      });

      it("refuses deleting a production from sam, with every permission but not an admin", async () => {
        const { api } = setUpProps(["2027", "2028"]);

        const res = await api(
          as("[casting stage tech wardrobe director]")("DELETE", "/api/productions/2027"),
        );

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
        const { productions } = JSON.parse(
          (await api(as("[admin]")("GET", "/api/productions"))).body ?? "",
        );
        expect(productions.toSorted()).toEqual(["2027", "2028"]);
      });

      it("keeps pat's Stage access once a past production is deleted", async () => {
        const { api, props } = setUpProps(["2027", "2028"]);

        await api(as("[admin]")("DELETE", "/api/productions/2027"));
        const added = await api(
          as("[stage]")("POST", `/api/productions/2028/items/${pirate}/props`, {
            name: "Treasure chest",
          }),
        );

        expect(added.statusCode).toBe(201);
        expect((await props.list("2028")).props).toHaveLength(1);
      });

      it("refuses starting a production from sam, with every permission but not an admin", async () => {
        const { api } = setUpProps();

        const res = await api(
          as("[casting stage tech wardrobe director]")("POST", "/api/productions", {
            year: "2028",
          }),
        );

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({ message: "Only admins can do this." });
        const { productions } = JSON.parse(
          (await api(as("[admin]")("GET", "/api/productions"))).body ?? "",
        );
        expect(productions).toEqual(["2027"]);
      });

      const PROP_PATH = "/api/productions/2027/props/1";
      const editProp = (groups: string) =>
        as(groups)("PUT", PROP_PATH, { name: "Gold chest", roleIds: [] });
      const removeProp = (groups: string) => as(groups)("DELETE", PROP_PATH);
      const treasureChest = {
        id: 1,
        itemId: pirate,
        name: "Treasure chest",
        quantity: 1,
        roleIds: [],
        carrierIds: [],
      };

      it.each([
        ["pat, with Stage", "[stage]"],
        ["dee, with Director", "[director]"],
        ["alex, an admin", "[admin]"],
      ])("edits and removes a prop for %s", async (_who, groups) => {
        const { api, props } = setUpProps();
        await api(addProp("[stage]", "Treasure chest"));

        expect((await api(editProp(groups))).statusCode).toBe(200);
        expect((await props.list("2027")).props).toEqual([
          { ...treasureChest, name: "Gold chest" },
        ]);
        expect((await api(removeProp(groups))).statusCode).toBe(204);
        expect((await props.list("2027")).props).toEqual([]);
      });

      it.each([
        ["sam, with Casting only", "[casting]"],
        ["lee, with Tech and Wardrobe", "[tech wardrobe]"],
        ["chris, with Wardrobe only", "[wardrobe]"],
      ])(
        "refuses to edit or remove a prop for %s, saying the props are read-only, changing nothing",
        async (_who, groups) => {
          const { api, props } = setUpProps();
          await api(addProp("[stage]", "Treasure chest"));

          for (const res of [await api(editProp(groups)), await api(removeProp(groups))]) {
            expect(res.statusCode).toBe(403);
            expect(JSON.parse(res.body ?? "")).toEqual(PROPS_READ_ONLY);
          }
          expect((await props.list("2027")).props).toEqual([treasureChest]);
        },
      );
    });

    describe("scenery notes, which need Stage, Tech or Director", () => {
      const setUpNotes = () => {
        const cast = inMemoryCastStore();
        const roles = inMemoryRoleStore();
        const itemNotes = inMemoryItemNoteStore();
        const propsNotes = inMemoryItemNoteStore();
        const api = lambdaEntry(
          createRoutes(
            {
              cast,
              roles,
              runningOrders: inMemoryRunningOrderStore([
                aRunningOrder(4, { first: ["Pirate Sketch"] }),
              ]),
              itemNotes,
              props: inMemoryPropStore(),
              propsNotes,
              sceneryNotes: inMemoryItemNoteStore(),
              sfxNotes: inMemoryItemNoteStore(),
              wardrobeNotes: inMemoryItemNoteStore(),
              micPlotNotes: inMemoryItemNoteStore(),
              micPlots: inMemoryMicPlotStore(),
              productions: inMemoryProductionListStore(),
              removeCastMember: uncastThenRemove(cast, roles),
            },
            inMemoryUsageStore(),
            { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
          ),
          inMemoryProductionListStore(),
        );
        return { api, itemNotes, propsNotes };
      };
      const NOTES_PATH = `/api/productions/2027/items/${pirate}/scenery-notes`;
      const saveNotes = (groups: string, text: string) =>
        as(groups)("PUT", NOTES_PATH, { revision: 0, text });
      const sceneryNotes = async (api: ReturnType<typeof setUpNotes>["api"]) =>
        ItemNoteList.parse(
          JSON.parse(
            (await api(as("[casting]")("GET", "/api/productions/2027/scenery-notes"))).body ?? "",
          ),
        ).notes.map((note) => note.text);

      it.each([
        ["pat, with Stage", "[stage]"],
        ["lee, with Tech", "[tech]"],
        ["dee, with Director", "[director]"],
        ["alex, an admin", "[admin]"],
      ])("saves scenery notes from %s, kept for the next read", async (_who, groups) => {
        const { api } = setUpNotes();

        const res = await api(saveNotes(groups, "Fly the cloud in after the blackout"));

        expect(res.statusCode).toBe(200);
        expect(await sceneryNotes(api)).toEqual(["Fly the cloud in after the blackout"]);
      });

      it("keeps scenery notes apart from the casting and props notes", async () => {
        const { api, itemNotes, propsNotes } = setUpNotes();
        await itemNotes.save("2027", pirate, 0, "Sword fight");
        await propsNotes.save("2027", pirate, 0, "Chest");

        await api(saveNotes("[tech]", "Cloud"));

        expect((await itemNotes.list("2027")).notes.map((note) => note.text)).toEqual([
          "Sword fight",
        ]);
        expect((await propsNotes.list("2027")).notes.map((note) => note.text)).toEqual(["Chest"]);
        expect(await sceneryNotes(api)).toEqual(["Cloud"]);
      });

      it("refuses scenery notes from sam, with Casting only, saving nothing", async () => {
        const { api } = setUpNotes();

        const res = await api(saveNotes("[casting]", "Cloud"));

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({
          message: "You can view the scenery, but not change it.",
          department: "scenery",
        });
        expect(await sceneryNotes(api)).toEqual([]);
      });
    });

    describe("deleting a scenery file, which needs Stage, Tech or Director", () => {
      // A file store that records what it was asked to delete.
      const setUpFiles = () => {
        const deleted: string[] = [];
        const cast = inMemoryCastStore();
        const roles = inMemoryRoleStore();
        const api = lambdaEntry(
          createRoutes(
            {
              cast,
              roles,
              runningOrders: inMemoryRunningOrderStore(),
              itemNotes: inMemoryItemNoteStore(),
              props: inMemoryPropStore(),
              propsNotes: inMemoryItemNoteStore(),
              sceneryNotes: inMemoryItemNoteStore(),
              sfxNotes: inMemoryItemNoteStore(),
              wardrobeNotes: inMemoryItemNoteStore(),
              micPlotNotes: inMemoryItemNoteStore(),
              micPlots: inMemoryMicPlotStore(),
              productions: inMemoryProductionListStore(),
              removeCastMember: uncastThenRemove(cast, roles),
            },
            inMemoryUsageStore(),
            {
              scenery: {
                ...noSceneryFiles,
                remove: async (production, item, name) => {
                  deleted.push(`${production}/${item}/${name}`);
                  return "removed";
                },
              },
              sfx: noSceneryFiles,
              wardrobe: noSceneryFiles,
            },
          ),
          inMemoryProductionListStore(),
        );
        return { api, deleted };
      };
      const deleteSetPlan = (groups: string) =>
        request(
          "DELETE",
          "/api/productions/2027/items/opening-number/scenery-files",
          { queryStringParameters: { name: "set-plan.pdf" } },
          groups,
        );

      it.each([
        ["pat, with Stage", "[stage]"],
        ["lee, with Tech", "[tech]"],
        ["dee, with Director", "[director]"],
        ["alex, an admin", "[admin]"],
      ])("deletes the file for %s", async (_who, groups) => {
        const { api, deleted } = setUpFiles();

        expect((await api(deleteSetPlan(groups))).statusCode).toBe(204);
        expect(deleted).toEqual(["2027/opening-number/set-plan.pdf"]);
      });

      it.each([
        ["sam, with Casting only", "[casting]"],
        ["wren, with Wardrobe only", "[wardrobe]"],
        ["someone with no permissions", "[]"],
      ])("refuses %s, deleting nothing", async (_who, groups) => {
        const { api, deleted } = setUpFiles();

        const res = await api(deleteSetPlan(groups));

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({
          message: "You can view the scenery, but not change it.",
          department: "scenery",
        });
        expect(deleted).toEqual([]);
      });

      it.each([
        ["sam, with Casting only", "[casting]"],
        ["someone with no permissions", "[]"],
      ])("refuses an upload from %s", async (_who, groups) => {
        const { api } = setUpFiles();

        const res = await api(
          request(
            "POST",
            "/api/productions/2027/items/opening-number/scenery-uploads",
            { body: JSON.stringify({ name: "set-plan.pdf", size: 1 }) },
            groups,
          ),
        );

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual({
          message: "You can view the scenery, but not change it.",
          department: "scenery",
        });
      });
    });

    describe("props notes, which need Stage", () => {
      const PROPS_READ_ONLY = {
        message: "You can view the props, but not change them.",
        department: "props",
      };
      const setUpNotes = () => {
        const cast = inMemoryCastStore();
        const roles = inMemoryRoleStore();
        const itemNotes = inMemoryItemNoteStore();
        const api = lambdaEntry(
          createRoutes(
            {
              cast,
              roles,
              runningOrders: inMemoryRunningOrderStore([
                aRunningOrder(4, { first: ["Pirate Sketch"] }),
              ]),
              itemNotes,
              props: inMemoryPropStore(),
              propsNotes: inMemoryItemNoteStore(),
              sceneryNotes: inMemoryItemNoteStore(),
              sfxNotes: inMemoryItemNoteStore(),
              wardrobeNotes: inMemoryItemNoteStore(),
              micPlotNotes: inMemoryItemNoteStore(),
              micPlots: inMemoryMicPlotStore(),
              productions: inMemoryProductionListStore(),
              removeCastMember: uncastThenRemove(cast, roles),
            },
            inMemoryUsageStore(),
            { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
          ),
          inMemoryProductionListStore(),
        );
        return { api, itemNotes };
      };
      const NOTES_PATH = `/api/productions/2027/items/${pirate}/props-notes`;
      const saveNotes = (groups: string, revision: number, text: string) =>
        as(groups)("PUT", NOTES_PATH, { revision, text });
      const propsNotes = async (api: ReturnType<typeof setUpNotes>["api"]) =>
        ItemNoteList.parse(
          JSON.parse(
            (await api(as("[casting]")("GET", "/api/productions/2027/props-notes"))).body ?? "",
          ),
        ).notes;

      it.each([
        ["pat, with Stage", "[stage]"],
        ["dee, with Director", "[director]"],
        ["alex, an admin", "[admin]"],
      ])("saves props notes from %s, kept for the next read", async (_who, groups) => {
        const { api } = setUpNotes();

        const res = await api(saveNotes(groups, 0, "Chest set stage left before the blackout"));

        expect(res.statusCode).toBe(200);
        expect(await propsNotes(api)).toEqual([
          { itemId: pirate, text: "Chest set stage left before the blackout", revision: 1 },
        ]);
      });

      it("keeps props notes apart from the casting notes", async () => {
        const { api, itemNotes } = setUpNotes();
        await itemNotes.save("2027", pirate, 0, "Captain needs a sword fight rehearsal");

        await api(saveNotes("[stage]", 0, "Chest set stage left"));

        expect((await itemNotes.list("2027")).notes.map((note) => note.text)).toEqual([
          "Captain needs a sword fight rehearsal",
        ]);
        expect((await propsNotes(api)).map((note) => note.text)).toEqual(["Chest set stage left"]);
      });

      it("refuses props notes over 500 characters, saving nothing", async () => {
        const { api } = setUpNotes();

        const res = await api(saveNotes("[stage]", 0, "x".repeat(501)));

        expect(res.statusCode).toBe(400);
        expect(await propsNotes(api)).toEqual([]);
      });

      it("clears props notes saved as empty text", async () => {
        const { api } = setUpNotes();
        await api(saveNotes("[stage]", 0, "Chest set stage left"));

        await api(saveNotes("[stage]", 1, "  "));

        expect((await propsNotes(api)).map((note) => note.text)).toEqual([""]);
      });

      it("refuses a save made since someone else saved, keeping theirs", async () => {
        const { api } = setUpNotes();
        await api(saveNotes("[stage]", 0, "Theirs"));

        const res = await api(saveNotes("[stage]", 0, "Mine"));

        expect(res.statusCode).toBe(409);
        expect((await propsNotes(api)).map((note) => note.text)).toEqual(["Theirs"]);
      });

      it("keeps props notes when a new running-order version keeps the item", async () => {
        const { api } = setUpNotes();
        await api(saveNotes("[stage]", 0, "Chest set stage left"));

        const saved = await api(
          as("[admin]")("POST", "/api/productions/2027/running-order/versions", {
            baseVersion: 4,
            change: {
              type: "update",
              // Pirate Sketch moved to the second half, its props notes kept with it.
              halves: aRunningOrder(4, { second: ["Pirate Sketch"], first: [] }).halves.map(
                ({ id, items }) => ({ id, items }),
              ),
            },
          }),
        );

        expect(saved.statusCode).toBe(201);
        expect((await propsNotes(api)).map((note) => note.text)).toEqual(["Chest set stage left"]);
      });

      it("refuses props notes from sam, with Casting only, saying the props are read-only", async () => {
        const { api } = setUpNotes();

        const res = await api(saveNotes("[casting]", 0, "Chest"));

        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(PROPS_READ_ONLY);
        expect(await propsNotes(api)).toEqual([]);
      });
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

  describe("SFX files and notes (production-sfx-wardrobe E1.S1)", () => {
    const opening = itemId("Opening Number");
    const SFX_READ_ONLY = {
      message: "You can view the SFX, but not change them.",
      department: "sfx",
    };
    let folder: string;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "lambda-sfx-"));
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });

    const setUpSfx = () => {
      const cast = inMemoryCastStore();
      const roles = inMemoryRoleStore();
      const sceneryNotes = inMemoryItemNoteStore();
      const api = lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders: inMemoryRunningOrderStore([
              aRunningOrder(4, { first: ["Opening Number", "Finale"] }),
            ]),
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes,
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          {
            scenery: folderItemFileStore(folder, "scenery"),
            sfx: folderItemFileStore(folder, "sfx"),
            wardrobe: folderItemFileStore(folder, "wardrobe"),
          },
        ),
        inMemoryProductionListStore(),
      );
      return { api, sceneryNotes };
    };

    // Put straight into file storage, as an upload would (made-up files).
    async function putFile(department: string, name: string) {
      const place = join(folder, "2027", opening, department);
      await mkdir(place, { recursive: true });
      await writeFile(join(place, name), "made-up");
    }
    // A request signed in with the groups, with a JSON body or query string as given.
    const as =
      (groups: string) =>
      (method: string, rawPath: string, extra: { body?: unknown; query?: object } = {}) =>
        request(
          method,
          rawPath,
          {
            ...(extra.body === undefined ? {} : { body: JSON.stringify(extra.body) }),
            ...(extra.query === undefined ? {} : { queryStringParameters: extra.query }),
          },
          groups,
        );
    const itemPath = (end: string) => `/api/productions/2027/items/${opening}/${end}`;
    const namesAt = async (api: ReturnType<typeof setUpSfx>["api"], end: string) =>
      ItemFileList.parse(
        JSON.parse((await api(as("[casting]")("GET", itemPath(end)))).body ?? ""),
      ).files.map((file) => file.name);
    const deleteThunder = (groups: string) =>
      as(groups)("DELETE", itemPath("sfx-files"), { query: { name: "thunder.mp3" } });
    const uploadThunder = (groups: string) =>
      as(groups)("POST", itemPath("sfx-uploads"), {
        body: { name: "thunder.mp3", size: 2_400_000 },
      });
    const saveSfxNotes = (groups: string, text: string) =>
      as(groups)("PUT", itemPath("sfx-notes"), { body: { revision: 0, text } });
    const notesAt = async (api: ReturnType<typeof setUpSfx>["api"], list: string) =>
      ItemNoteList.parse(
        JSON.parse((await api(as("[casting]")("GET", `/api/productions/2027/${list}`))).body ?? ""),
      ).notes;

    it("lists only the item's SFX files on the SFX route, and only its scenery files on Scenery's", async () => {
      const { api } = setUpSfx();
      await putFile("scenery", "set-plan.pdf");
      await putFile("sfx", "thunder.mp3");

      expect(await namesAt(api, "sfx-files")).toEqual(["thunder.mp3"]);
      expect(await namesAt(api, "scenery-files")).toEqual(["set-plan.pdf"]);
    });

    it("counts each item's SFX and Wardrobe files on their own routes, for anyone signed in", async () => {
      const { api } = setUpSfx();
      await putFile("scenery", "set-plan.pdf");
      for (const name of ["thunder.mp3", "rain.mp3", "bell.wav"]) await putFile("sfx", name);
      await putFile("wardrobe", "jacket-pattern.pdf");
      const countsAt = async (list: string) => {
        const res = await api(as("[]")("GET", `/api/productions/2027/${list}`));
        expect(res.statusCode).toBe(200);
        return ItemFileCounts.parse(JSON.parse(res.body ?? "")).counts;
      };

      expect(await countsAt("sfx-file-counts")).toEqual({ [opening]: 3 });
      expect(await countsAt("wardrobe-file-counts")).toEqual({ [opening]: 1 });
      expect(await countsAt("scenery-file-counts")).toEqual({ [opening]: 1 });
    });

    it("links to an SFX file, which anyone signed in may ask for", async () => {
      const { api } = setUpSfx();
      await putFile("sfx", "thunder.mp3");

      const res = await api(
        as("[]")("GET", itemPath("sfx-file-link"), { query: { name: "thunder.mp3" } }),
      );

      expect(res.statusCode).toBe(200);
      expect(ItemFileLink.parse(JSON.parse(res.body ?? "")).url).toContain("/sfx/thunder.mp3");
    });

    it("refuses an SFX request for a scenery file, leaving it untouched", async () => {
      const { api } = setUpSfx();
      await putFile("scenery", "set-plan.pdf");
      const name = { query: { name: "../scenery/set-plan.pdf" } };

      const deleted = await api(as("[tech]")("DELETE", itemPath("sfx-files"), name));
      const linked = await api(as("[tech]")("GET", itemPath("sfx-file-link"), name));

      expect([deleted.statusCode, linked.statusCode]).toEqual([400, 400]);
      expect(existsSync(join(folder, "2027", opening, "scenery", "set-plan.pdf"))).toBe(true);
    });

    it.each([
      ["lee, with Tech", "[tech]"],
      ["dee, with Director", "[director]"],
      ["ash, an admin", "[admin]"],
    ])("lets %s upload, delete and change the SFX notes", async (_who, groups) => {
      const { api } = setUpSfx();
      await putFile("sfx", "thunder.mp3");

      const deleted = await api(deleteThunder(groups));
      const uploaded = await api(uploadThunder(groups));
      const saved = await api(saveSfxNotes(groups, "Thunder on the second verse"));

      expect([deleted.statusCode, uploaded.statusCode, saved.statusCode]).toEqual([204, 200, 200]);
    });

    it("refuses pat, with Stage only, an upload, delete or note change, saying the SFX is view-only", async () => {
      const { api } = setUpSfx();
      await putFile("sfx", "thunder.mp3");

      for (const res of [
        await api(uploadThunder("[stage]")),
        await api(deleteThunder("[stage]")),
        await api(saveSfxNotes("[stage]", "Thunder")),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(SFX_READ_ONLY);
      }
      expect(await namesAt(api, "sfx-files")).toEqual(["thunder.mp3"]);
      expect(await notesAt(api, "sfx-notes")).toEqual([]);
    });

    it("keeps SFX notes per item, apart from the scenery notes", async () => {
      const { api, sceneryNotes } = setUpSfx();
      await sceneryNotes.save("2027", opening, 0, "Cloud");

      await api(saveSfxNotes("[tech]", "Thunder on the second verse"));

      expect(await notesAt(api, "sfx-notes")).toEqual([
        { itemId: opening, text: "Thunder on the second verse", revision: 1 },
      ]);
      expect(await notesAt(api, "scenery-notes")).toEqual([
        { itemId: opening, text: "Cloud", revision: 1 },
      ]);
    });
  });

  describe("Wardrobe files and notes (production-sfx-wardrobe E1.S2)", () => {
    const opening = itemId("Opening Number");
    const WARDROBE_READ_ONLY = {
      message: "You can view the wardrobe, but not change it.",
      department: "wardrobe",
    };
    let folder: string;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "lambda-wardrobe-"));
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });

    const setUpWardrobe = () => {
      const cast = inMemoryCastStore();
      const roles = inMemoryRoleStore();
      const sceneryNotes = inMemoryItemNoteStore();
      const sfxNotes = inMemoryItemNoteStore();
      const api = lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders: inMemoryRunningOrderStore([
              aRunningOrder(4, { first: ["Opening Number", "Finale"] }),
            ]),
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes,
            sfxNotes,
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          {
            scenery: folderItemFileStore(folder, "scenery"),
            sfx: folderItemFileStore(folder, "sfx"),
            wardrobe: folderItemFileStore(folder, "wardrobe"),
          },
        ),
        inMemoryProductionListStore(),
      );
      return { api, sceneryNotes, sfxNotes };
    };

    // Put straight into file storage, as an upload would (made-up files).
    async function putFile(department: string, name: string) {
      const place = join(folder, "2027", opening, department);
      await mkdir(place, { recursive: true });
      await writeFile(join(place, name), "made-up");
    }
    // A request signed in with the groups, with a JSON body or query string as given.
    const as =
      (groups: string) =>
      (method: string, rawPath: string, extra: { body?: unknown; query?: object } = {}) =>
        request(
          method,
          rawPath,
          {
            ...(extra.body === undefined ? {} : { body: JSON.stringify(extra.body) }),
            ...(extra.query === undefined ? {} : { queryStringParameters: extra.query }),
          },
          groups,
        );
    const itemPath = (end: string) => `/api/productions/2027/items/${opening}/${end}`;
    const namesAt = async (api: ReturnType<typeof setUpWardrobe>["api"], end: string) =>
      ItemFileList.parse(
        JSON.parse((await api(as("[casting]")("GET", itemPath(end)))).body ?? ""),
      ).files.map((file) => file.name);
    const deletePattern = (groups: string) =>
      as(groups)("DELETE", itemPath("wardrobe-files"), { query: { name: "jacket-pattern.pdf" } });
    const uploadPattern = (groups: string) =>
      as(groups)("POST", itemPath("wardrobe-uploads"), {
        body: { name: "jacket-pattern.pdf", size: 1_200_000 },
      });
    const saveWardrobeNotes = (groups: string, text: string) =>
      as(groups)("PUT", itemPath("wardrobe-notes"), { body: { revision: 0, text } });
    const notesAt = async (api: ReturnType<typeof setUpWardrobe>["api"], list: string) =>
      ItemNoteList.parse(
        JSON.parse((await api(as("[casting]")("GET", `/api/productions/2027/${list}`))).body ?? ""),
      ).notes;

    it("lists only the item's Wardrobe files on the Wardrobe route, not its scenery or SFX files", async () => {
      const { api } = setUpWardrobe();
      await putFile("scenery", "set-plan.pdf");
      await putFile("sfx", "thunder.mp3");
      await putFile("wardrobe", "jacket-pattern.pdf");

      expect(await namesAt(api, "wardrobe-files")).toEqual(["jacket-pattern.pdf"]);
    });

    it("links to a Wardrobe file, which anyone signed in may ask for", async () => {
      const { api } = setUpWardrobe();
      await putFile("wardrobe", "colour-swatch.png");

      const res = await api(
        as("[]")("GET", itemPath("wardrobe-file-link"), { query: { name: "colour-swatch.png" } }),
      );

      expect(res.statusCode).toBe(200);
      expect(ItemFileLink.parse(JSON.parse(res.body ?? "")).url).toContain(
        "/wardrobe/colour-swatch.png",
      );
    });

    it("refuses a Wardrobe request for an SFX file, leaving it untouched", async () => {
      const { api } = setUpWardrobe();
      await putFile("sfx", "thunder.mp3");
      const name = { query: { name: "../sfx/thunder.mp3" } };

      const deleted = await api(as("[wardrobe]")("DELETE", itemPath("wardrobe-files"), name));
      const linked = await api(as("[wardrobe]")("GET", itemPath("wardrobe-file-link"), name));

      expect([deleted.statusCode, linked.statusCode]).toEqual([400, 400]);
      expect(existsSync(join(folder, "2027", opening, "sfx", "thunder.mp3"))).toBe(true);
    });

    it.each([
      ["kit, with Wardrobe", "[wardrobe]"],
      ["dee, with Director", "[director]"],
      ["ash, an admin", "[admin]"],
    ])("lets %s upload, delete and change the Wardrobe notes", async (_who, groups) => {
      const { api } = setUpWardrobe();
      await putFile("wardrobe", "jacket-pattern.pdf");

      const deleted = await api(deletePattern(groups));
      const uploaded = await api(uploadPattern(groups));
      const saved = await api(saveWardrobeNotes(groups, "Gold jackets for the chorus"));

      expect([deleted.statusCode, uploaded.statusCode, saved.statusCode]).toEqual([204, 200, 200]);
    });

    it("refuses lee, with Tech only, an upload, delete or note change, saying the wardrobe is view-only", async () => {
      const { api } = setUpWardrobe();
      await putFile("wardrobe", "jacket-pattern.pdf");

      for (const res of [
        await api(uploadPattern("[tech]")),
        await api(deletePattern("[tech]")),
        await api(saveWardrobeNotes("[tech]", "Gold jackets")),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body ?? "")).toEqual(WARDROBE_READ_ONLY);
      }
      expect(await namesAt(api, "wardrobe-files")).toEqual(["jacket-pattern.pdf"]);
      expect(await notesAt(api, "wardrobe-notes")).toEqual([]);
    });

    it("keeps Wardrobe notes per item, apart from the scenery and SFX notes", async () => {
      const { api, sceneryNotes, sfxNotes } = setUpWardrobe();
      await sceneryNotes.save("2027", opening, 0, "Cloud");
      await sfxNotes.save("2027", opening, 0, "Thunder");

      await api(saveWardrobeNotes("[wardrobe]", "Gold jackets for the chorus"));

      expect(await notesAt(api, "wardrobe-notes")).toEqual([
        { itemId: opening, text: "Gold jackets for the chorus", revision: 1 },
      ]);
      expect(await notesAt(api, "scenery-notes")).toEqual([
        { itemId: opening, text: "Cloud", revision: 1 },
      ]);
      expect(await notesAt(api, "sfx-notes")).toEqual([
        { itemId: opening, text: "Thunder", revision: 1 },
      ]);
    });
  });

  describe("mic plot (production-mics E1.S1)", () => {
    const opening = itemId("Opening Number");
    const MIC_PLOT_READ_ONLY = {
      message: "You can view the mic plot, but not change it.",
      department: "mic-plot",
    };
    // Made-up cast: Alex Morgan (1) and Sam Patel (2) are cast in Opening Number; Jo Reed (3)
    // only in the Finale.
    const [alex, sam, jo] = [1, 2, 3];

    const setUpMics = () => {
      const cast = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(2), aCastMember(3)])]);
      const roles = inMemoryRoleStore([
        {
          productionId: "2027",
          roles: [
            {
              id: 1,
              itemId: opening,
              name: "Chorus",
              size: "ensemble",
              castMemberIds: [alex, sam],
              revision: 1,
            },
            {
              id: 2,
              itemId: itemId("Finale"),
              name: "Soloist",
              size: "lead",
              castMemberIds: [jo],
              revision: 1,
            },
          ],
        },
      ]);
      return lambdaEntry(
        createRoutes(
          {
            cast,
            roles,
            runningOrders: inMemoryRunningOrderStore([
              aRunningOrder(4, { first: ["Opening Number", "Finale"] }),
            ]),
            itemNotes: inMemoryItemNoteStore(),
            props: inMemoryPropStore(),
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
      );
    };
    const give = (groups: string, channel: number, castMemberId: number | null) =>
      request(
        "PUT",
        `/api/productions/2027/items/${opening}/mic-plot`,
        { body: JSON.stringify({ channel, castMemberId }) },
        groups,
      );
    const micsAt = async (api: ReturnType<typeof setUpMics>) =>
      MicPlotList.parse(
        JSON.parse(
          (await api(request("GET", "/api/productions/2027/mic-plot", {}, "[]"))).body ?? "",
        ),
      ).items;

    it("lets lee, with Tech, give Mic 3 to Alex, which anyone signed in then reads, and clear it", async () => {
      const api = setUpMics();

      expect((await api(give("[tech]", 3, alex))).statusCode).toBe(200);
      expect(await micsAt(api)).toEqual([
        { itemId: opening, mics: [{ channel: 3, castMemberId: alex }] },
      ]);

      expect((await api(give("[tech]", 3, null))).statusCode).toBe(200);
      expect(await micsAt(api)).toEqual([]);
    });

    it.each([
      ["dee, with Director only", "[director]"],
      ["alex, an admin", "[admin]"],
    ])("saves Mic 5 for Sam when %s gives it", async (_who, groups) => {
      const api = setUpMics();

      expect((await api(give(groups, 5, sam))).statusCode).toBe(200);
      expect(await micsAt(api)).toEqual([
        { itemId: opening, mics: [{ channel: 5, castMemberId: sam }] },
      ]);
    });

    it.each([
      ["kim, with Casting, Stage and Wardrobe", "[casting stage wardrobe]"],
      ["someone with no permissions", "[]"],
    ])(
      "refuses %s a mic, saying the mic plot is view-only, and changes nothing",
      async (_who, groups) => {
        const api = setUpMics();
        await api(give("[tech]", 3, alex));
        const before = await micsAt(api);

        for (const change of [give(groups, 5, sam), give(groups, 3, null)]) {
          const res = await api(change);
          expect(res.statusCode).toBe(403);
          expect(JSON.parse(res.body ?? "")).toEqual(MIC_PLOT_READ_ONLY);
        }
        expect(await micsAt(api)).toEqual(before);
      },
    );

    it.each([
      ["Jo, who isn't cast in the item", 4, jo, 400],
      ["Alex, already on Mic 3", 4, alex, 409],
      ["Mic 25", 25, sam, 400],
      ["Mic 0", 0, sam, 400],
    ])("refuses Tech giving a mic to %s, changing nothing", async (_what, channel, who, status) => {
      const api = setUpMics();
      await api(give("[tech]", 3, alex));
      const before = await micsAt(api);

      expect((await api(give("[tech]", channel, who))).statusCode).toBe(status);
      expect(await micsAt(api)).toEqual(before);
    });

    describe("Mic plot notes (production-mics E1.S3)", () => {
      const saveNotes = (groups: string, text: string) =>
        request(
          "PUT",
          `/api/productions/2027/items/${opening}/mic-plot-notes`,
          { body: JSON.stringify({ revision: 0, text }) },
          groups,
        );
      const notesAt = async (api: ReturnType<typeof setUpMics>, list: string) =>
        ItemNoteList.parse(
          JSON.parse(
            (await api(request("GET", `/api/productions/2027/${list}`, {}, "[]"))).body ?? "",
          ),
        ).notes;

      it.each([
        ["lee, with Tech", "[tech]"],
        ["dee, with Director only", "[director]"],
        ["alex, an admin", "[admin]"],
      ])(
        "saves the notes when %s writes them, which anyone signed in then reads",
        async (_who, groups) => {
          const api = setUpMics();

          const saved = await api(saveNotes(groups, "Mics 19–24 on for songs only"));

          expect(saved.statusCode).toBe(200);
          expect(await notesAt(api, "mic-plot-notes")).toEqual([
            { itemId: opening, text: "Mics 19–24 on for songs only", revision: 1 },
          ]);
        },
      );

      it.each([
        ["kim, with Casting, Stage and Wardrobe", "[casting stage wardrobe]"],
        ["someone with no permissions", "[]"],
      ])(
        "refuses %s a change to the notes, saying the mic plot is view-only",
        async (_who, groups) => {
          const api = setUpMics();

          const res = await api(saveNotes(groups, "Mics off"));

          expect(res.statusCode).toBe(403);
          expect(JSON.parse(res.body ?? "")).toEqual(MIC_PLOT_READ_ONLY);
          expect(await notesAt(api, "mic-plot-notes")).toEqual([]);
        },
      );

      it("keeps Mic plot notes apart from the SFX notes", async () => {
        const api = setUpMics();

        await api(saveNotes("[tech]", "Mics 19–24 on for songs only"));

        expect(await notesAt(api, "sfx-notes")).toEqual([]);
      });
    });
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
            propsNotes: inMemoryItemNoteStore(),
            sceneryNotes: inMemoryItemNoteStore(),
            sfxNotes: inMemoryItemNoteStore(),
            wardrobeNotes: inMemoryItemNoteStore(),
            micPlotNotes: inMemoryItemNoteStore(),
            micPlots: inMemoryMicPlotStore(),
            productions: inMemoryProductionListStore(),
            removeCastMember: uncastThenRemove(cast, roles),
          },
          inMemoryUsageStore(),
          { scenery: noSceneryFiles, sfx: noSceneryFiles, wardrobe: noSceneryFiles },
        ),
        inMemoryProductionListStore(),
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
