import { once } from "node:events";
import { readFileSync } from "node:fs";
import { request, type Server } from "node:http";
import {
  AccountList,
  adminOnlyRouteKeys,
  HealthResponse,
  LOCAL_ACCESS_HEADER,
  UsageSummary,
} from "@app/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDevServer, devRoutes, startDevServer } from "./dev-server.ts";
import { routes } from "./routes.ts";

describe("dev server", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createDevServer(routes);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("serves GET /api/health over HTTP", async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(HealthResponse.parse(await res.json()).status).toBe("ok");
  });

  it("returns 404 for a malformed path escape and keeps serving", async () => {
    const res = await fetch(`${baseUrl}/api/productions/%E0%A4%A/running-order`);

    expect(res.status).toBe(404);
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
  });

  it("routes POST running order versions to the save handler", async () => {
    const res = await fetch(`${baseUrl}/api/productions/2027/running-order/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
  });

  it("serves the casting grid export as the bytes of an Excel file, not base64 text", async () => {
    const grid = {
      items: [{ heading: "1.1 · Opening Number", printed: true }],
      rows: [{ firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["L"] }],
    };

    const res = await fetch(`${baseUrl}/api/productions/2027/casting-grid/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grid),
    });

    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
  });

  it("rejects an oversized request body with 413", async () => {
    const res = await fetch(`${baseUrl}/api/productions/2027/running-order/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(300 * 1024),
    });

    expect(res.status).toBe(413);
  });

  it("refuses a write that isn't JSON, as a cross-site form or text/plain post would be", async () => {
    const res = await fetch(`${baseUrl}/api/productions/2027/cast`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: '{"firstName":"Jo","lastName":"Newcomer","section":null,"group":""}',
    });

    expect(res.status).toBe(415);
  });

  it("refuses requests from another site's page", async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "https://evil.example" },
    });

    expect(res.status).toBe(403);
  });

  it("allows requests from the local web app", async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
  });

  it("returns 404 for routes that don't exist", async () => {
    const res = await fetch(`${baseUrl}/api/nope`);

    expect(res.status).toBe(404);
  });
});

describe("dev server path parameters", () => {
  it("passes {placeholders} in the route to the handler as path parameters", async () => {
    const server = createDevServer({
      "GET /api/things/{thingId}": async (event) => ({
        statusCode: 200,
        body: event.pathParameters?.thingId ?? "",
      }),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const res = await fetch(`http://localhost:${address.port}/api/things/2027`);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("2027");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server request bodies", () => {
  it("passes the request body to the handler", async () => {
    const server = createDevServer({
      "POST /api/echo": async (event) => ({ statusCode: 201, body: event.body ?? "" }),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const res = await fetch(`http://localhost:${address.port}/api/echo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"hello":"there"}',
      });

      expect(res.status).toBe(201);
      expect(await res.text()).toBe('{"hello":"there"}');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server query strings", () => {
  it("passes query string parameters to the handler", async () => {
    const server = createDevServer({
      "DELETE /api/things/{thingId}": async (event) => ({
        statusCode: 200,
        body: event.queryStringParameters?.revision ?? "none",
      }),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const res = await fetch(`http://localhost:${address.port}/api/things/12?revision=4`, {
        method: "DELETE",
      });

      expect(await res.text()).toBe("4");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server admin-only routes", () => {
  it("runs them with no sign-in, as everyone is an admin locally (ADR 0018)", async () => {
    const reached: string[] = [];
    const table = Object.fromEntries(
      adminOnlyRouteKeys.map((key) => [
        key,
        async () => {
          reached.push(key);
          return { statusCode: 204 };
        },
      ]),
    );
    const server = createDevServer(table);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      for (const key of adminOnlyRouteKeys) {
        const [method = "", route = ""] = key.split(" ");
        const path = route.replaceAll(/\{\w+\}/g, "2027");
        const res = await fetch(`http://localhost:${address.port}${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: method === "POST" || method === "PUT" ? "{}" : null,
        });

        expect(res.status).toBe(204);
      }
      expect(reached).toEqual([...adminOnlyRouteKeys]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server when a handler fails", () => {
  it("returns 500 instead of crashing when a handler throws", async () => {
    const server = createDevServer({
      "GET /api/boom": () => Promise.reject(new Error("boom")),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const res = await fetch(`http://localhost:${address.port}/api/boom`);

      expect(res.status).toBe(500);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server host check", () => {
  it("refuses a request addressed to another host name (DNS rebinding)", async () => {
    const server = createDevServer(routes);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(
          {
            host: "127.0.0.1",
            port: address.port,
            path: "/api/health",
            headers: { host: "evil.example" },
          },
          (res) => resolve(res.statusCode),
        );
        req.on("error", reject);
        req.end();
      });

      expect(status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server routes", () => {
  it("serve the account routes too, on the made-up local accounts", async () => {
    const server = createDevServer(devRoutes());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");

    try {
      const res = await fetch(`http://localhost:${address.port}/api/accounts`);

      expect(res.status).toBe(200);
      expect(AccountList.parse(await res.json()).accounts).not.toEqual([]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("dev server usage (usage-tracking AC14)", () => {
  // Stands in for the data routes on the remote table, which local usage must never reach.
  const remote = {
    ...routes,
    "POST /api/usage": async () => {
      throw new Error("wrote usage to the remote table");
    },
    "GET /api/usage": async () => {
      throw new Error("read usage from the remote table");
    },
  };

  it("keeps usage in memory for the made-up local admin, never in the remote table", async () => {
    const local = devRoutes(remote);

    const recorded = await local["POST /api/usage"]({ body: JSON.stringify({ event: "session" }) });
    const read = await local["GET /api/usage"]({});

    expect(recorded.statusCode).toBe(204);
    expect(UsageSummary.parse(JSON.parse(read.body ?? "")).people).toEqual([
      expect.objectContaining({ username: "alex", sessions: 1 }),
    ]);
  });

  it("starts with no usage each time the local API starts", async () => {
    await devRoutes(remote)["POST /api/usage"]({ body: JSON.stringify({ event: "session" }) });

    const read = await devRoutes(remote)["GET /api/usage"]({});

    expect(UsageSummary.parse(JSON.parse(read.body ?? "")).people).toEqual([]);
  });
});

describe("dev server local access (production-props FR9)", () => {
  const reached: string[] = [];
  const table = {
    "GET /api/productions/{productionId}/cast": async () => {
      reached.push("read");
      return { statusCode: 200 };
    },
    "POST /api/productions/{productionId}/cast": async () => {
      reached.push("add");
      return { statusCode: 201 };
    },
    "DELETE /api/productions/{productionId}/cast/{castId}": async () => {
      reached.push("delete");
      return { statusCode: 204 };
    },
    "POST /api/usage": async () => {
      reached.push("usage");
      return { statusCode: 204 };
    },
  };
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createDevServer(table);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const send = (method: string, path: string, access?: string) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(access === undefined ? {} : { [LOCAL_ACCESS_HEADER]: access }),
      },
      body: method === "POST" ? "{}" : null,
    });

  it("refuses Stage and Tech's casting changes as the hosted API does, and lets them read", async () => {
    reached.length = 0;

    const add = await send("POST", "/api/productions/2027/cast", "stage,tech");
    const read = await send("GET", "/api/productions/2027/cast", "stage,tech");

    expect(add.status).toBe(403);
    expect(await add.json()).toEqual({ message: "You can view the casting, but not change it." });
    expect(read.status).toBe(200);
    expect(reached).toEqual(["read"]);
  });

  it("lets Casting change casting but keeps admin-only routes from it", async () => {
    reached.length = 0;

    const add = await send("POST", "/api/productions/2027/cast", "casting");
    const remove = await send("DELETE", "/api/productions/2027/cast/1", "casting");

    expect(add.status).toBe(201);
    expect(remove.status).toBe(403);
    expect(await remove.json()).toEqual({ message: "Only admins can do this." });
    expect(reached).toEqual(["add"]);
  });

  it("refuses every change with no permissions, letting them only read and record their use", async () => {
    reached.length = 0;

    const add = await send("POST", "/api/productions/2027/cast", "");
    const remove = await send("DELETE", "/api/productions/2027/cast/1", "");
    const read = await send("GET", "/api/productions/2027/cast", "");
    const usage = await send("POST", "/api/usage", "");

    expect([add.status, remove.status, read.status, usage.status]).toEqual([403, 403, 200, 204]);
    expect(reached).toEqual(["read", "usage"]);
  });

  it("acts for an admin when no access is chosen", async () => {
    reached.length = 0;

    const remove = await send("DELETE", "/api/productions/2027/cast/1");

    expect(remove.status).toBe(204);
    expect(reached).toEqual(["delete"]);
  });

  it("treats access it doesn't know as read-only", async () => {
    reached.length = 0;

    const add = await send("POST", "/api/productions/2027/cast", "owner");

    expect(add.status).toBe(403);
    expect(reached).toEqual([]);
  });
});

describe("dev server release", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports the version release-please recorded in its manifest", async () => {
    vi.stubEnv("APP_VERSION", undefined);
    const manifest = JSON.parse(
      readFileSync(new URL("../../../.release-please-manifest.json", import.meta.url), "utf8"),
    );

    const server = startDevServer(0);
    await once(server, "listening");
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server not listening");
    const res = await fetch(`http://localhost:${address.port}/api/health`);
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(HealthResponse.parse(await res.json()).version).toBe(manifest["."]);
  });
});
