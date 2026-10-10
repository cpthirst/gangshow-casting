// Local stand-in for API Gateway: serves the same handlers Lambda will run (ADR 0006).
import { createServer } from "node:http";
import type { Handler } from "./handler.ts";
import { matchRoute, routes } from "./routes.ts";

export function createDevServer(table: Record<string, Handler>) {
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const route = matchRoute(table, req.method ?? "", path);
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    try {
      const { statusCode = 200, headers = {}, body } = await route.handler(route.event);
      // Lambda allows boolean/number header values; node:http wants strings.
      const outgoing = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
      res.writeHead(statusCode, outgoing).end(body);
    } catch (error) {
      process.stderr.write(`${req.method} ${path} failed: ${error}\n`);
      res.writeHead(500).end();
    }
  });
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  // Loopback only: the dev API is unauthenticated, so keep it off the local network.
  createDevServer(routes).listen(port, "127.0.0.1", () => {
    process.stdout.write(`api listening on http://127.0.0.1:${port}\n`);
  });
}
