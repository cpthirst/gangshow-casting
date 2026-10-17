// Local stand-in for API Gateway: serves the same handlers Lambda will run (ADR 0006).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Handler } from "./handler.ts";
import { matchRoute } from "./match-route.ts";
import { dataLocation, routes } from "./routes.ts";

export function createDevServer(table: Record<string, Handler>) {
  return createServer(async (req, res) => {
    const refused = refusal(req);
    if (refused) {
      res.writeHead(refused).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const route = matchRoute(table, req.method ?? "", path);
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY_BYTES) {
      tooLarge(res);
      return;
    }
    try {
      const body = await readBody(req);
      // Like API Gateway, leave out body and queryStringParameters when there are none.
      const event = {
        ...route.event,
        ...(body === undefined ? {} : { body }),
        ...(url.search === ""
          ? {}
          : { queryStringParameters: Object.fromEntries(url.searchParams) }),
      };
      const { statusCode = 200, headers = {}, body: responseBody } = await route.handler(event);
      // Lambda allows boolean/number header values; node:http wants strings.
      const outgoing = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
      res.writeHead(statusCode, outgoing).end(responseBody);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        tooLarge(res);
        return;
      }
      process.stderr.write(`${req.method} ${path} failed: ${error}\n`);
      res.writeHead(500).end();
    }
  });
}

// The dev API serves real cast data with no sign-in, so only the local web app may use it:
// - Host must be local, which stops DNS rebinding (another site's name pointed at 127.0.0.1);
// - Origin, when a browser sends one, must be local, so other sites' pages can't call it;
// - writes must be JSON, which a cross-site form or "simple" text/plain post can't send.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function refusal(req: IncomingMessage): 403 | 415 | undefined {
  if (!LOCAL_HOSTS.has(hostnameOf(`http://${req.headers.host ?? ""}`))) return 403;
  const { origin } = req.headers;
  if (origin !== undefined && !LOCAL_HOSTS.has(hostnameOf(origin))) return 403;
  const sendsBody = req.method === "POST" || req.method === "PUT" || req.method === "PATCH";
  const isJson = (req.headers["content-type"] ?? "").startsWith("application/json");
  return sendsBody && !isJson ? 415 : undefined;
}

// API Gateway caps payloads too; a running order is a few KB.
const MAX_BODY_BYTES = 256 * 1024;

class PayloadTooLargeError extends Error {}

// A client error, not a server fault: say so and stop reading.
function tooLarge(res: ServerResponse) {
  res.writeHead(413, { connection: "close" }).end();
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  // Loopback only: the dev API is unauthenticated, so keep it off the local network.
  createDevServer(routes).listen(port, "127.0.0.1", () => {
    process.stdout.write(`api listening on http://127.0.0.1:${port}; data: ${dataLocation}\n`);
  });
}
