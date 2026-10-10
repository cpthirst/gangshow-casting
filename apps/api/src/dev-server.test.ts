import type { Server } from "node:http";
import { HealthResponse } from "@app/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDevServer } from "./dev-server.ts";
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

  it("returns 404 for routes that don't exist", async () => {
    const res = await fetch(`${baseUrl}/api/nope`);

    expect(res.status).toBe(404);
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
