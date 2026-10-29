// Local stand-in for API Gateway: serves the same handlers Lambda will run (ADR 0006).
import { createReadStream, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import { LOCAL_ACCESS_HEADER, localAccessFrom } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { LOCAL_ADMIN, localAccountRoutes } from "#/accounts/local-accounts.ts";
import { accessRefusal } from "#/http/access.ts";
import type { Handler } from "#/http/handler.ts";
import { matchRoute } from "#/http/match-route.ts";
import { LOCAL_FILES_PATH, localFileAt } from "#/production/scenery/local-files.ts";
import { createUsageRoutes } from "#/usage/usage-routes.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { dataLocation, localFilesFolder, routes } from "./routes.ts";

/** The dev API, serving the scenery files in localFiles too when there's no bucket. */
export function createDevServer(table: Record<string, Handler>, localFiles?: string) {
  return createServer(async (req, res) => {
    const refused = refusal(req);
    if (refused) {
      res.writeHead(refused).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    // Stands in for the bucket's links, which need no sign-in either (ADR 0030).
    if (localFiles !== undefined && req.method === "GET" && path.startsWith(LOCAL_FILES_PATH)) {
      await sendLocalFile(res, localFiles, path);
      return;
    }
    const route = matchRoute(table, req.method ?? "", path);
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    // Like the hosted entry point, before the handler runs (ADR 0026).
    // The access chosen with the local switch (production-props FR9).
    const refusedAccess = accessRefusal(
      route.key,
      localAccessFrom(req.headers[LOCAL_ACCESS_HEADER]),
    );
    if (refusedAccess) {
      send(res, refusedAccess);
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
      send(res, await route.handler(event));
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

async function sendLocalFile(res: ServerResponse, folder: string, path: string) {
  const found = await localFileAt(folder, path);
  if (!found) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, found.headers);
  // Too late for a 404 if the file can't be read, or the browser stops reading: just cut it off.
  await pipeline(createReadStream(found.file), res).catch(() => res.destroy());
}

function send(
  res: ServerResponse,
  { statusCode = 200, headers = {}, body, isBase64Encoded }: APIGatewayProxyStructuredResultV2,
) {
  // Lambda allows boolean/number header values; node:http wants strings.
  const outgoing = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
  // API Gateway turns a base64 body back into bytes (an Excel file); so do we.
  res
    .writeHead(statusCode, outgoing)
    .end(isBase64Encoded && body ? Buffer.from(body, "base64") : body);
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

/**
 * What pnpm dev and pnpm demo serve: the data routes, with accounts that are always made up
 * locally, even when the data is remote (ADR 0018), and so usage too, kept in memory for
 * the made-up admin the local app acts as (ADR 0023).
 */
export const devRoutes = (dataRoutes = routes) => ({
  ...dataRoutes,
  ...localAccountRoutes(),
  ...createUsageRoutes(inMemoryUsageStore(), { who: () => LOCAL_ADMIN }),
});

/** The version release-please keeps in the root package.json, which the health route reports
 *  as APP_VERSION. Infra sets it on the deployed API the same way (releaseVersion in
 *  infra/lib/app-stack.ts); the two packages share no code. */
function releaseVersion(): string {
  const { version } = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  if (typeof version !== "string") throw new Error("The root package.json has no version");
  return version;
}

/** Starts the dev API on the port, reporting the release as the deployed API does. */
export function startDevServer(port: number) {
  process.env.APP_VERSION ??= releaseVersion();
  // Loopback only: the dev API is unauthenticated, so keep it off the local network.
  return createDevServer(devRoutes(), localFilesFolder).listen(port, "127.0.0.1", () => {
    process.stdout.write(`api listening on http://127.0.0.1:${port}; data: ${dataLocation}\n`);
  });
}

if (import.meta.main) startDevServer(Number(process.env.PORT ?? 3000));
