import { request, type Server } from "node:http";
import { AccountList, adminOnlyRouteKeys, HealthResponse } from "@app/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDevServer, devRoutes } from "./dev-server.ts";
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
