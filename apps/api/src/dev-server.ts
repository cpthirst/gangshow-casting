// Local stand-in for API Gateway: serves the same handlers Lambda will run (ADR 0006).
import { createServer, type IncomingMessage } from "node:http";
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
      const body = await readBody(req);
      const event = body === undefined ? route.event : { ...route.event, body };
      const { statusCode = 200, headers = {}, body: responseBody } = await route.handler(event);
      // Lambda allows boolean/number header values; node:http wants strings.
      const outgoing = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
      res.writeHead(statusCode, outgoing).end(responseBody);
    } catch (error) {
      process.stderr.write(`${req.method} ${path} failed: ${error}\n`);
      res.writeHead(500).end();
    }
  });
}

// API Gateway caps payloads too; a running order is a few KB.
const MAX_BODY_BYTES = 256 * 1024;

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  // Loopback only: the dev API is unauthenticated, so keep it off the local network.
  createDevServer(routes).listen(port, "127.0.0.1", () => {
    process.stdout.write(`api listening on http://127.0.0.1:${port}\n`);
  });
}
