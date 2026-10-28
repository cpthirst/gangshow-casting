import type { HealthResponse } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { jsonResponse } from "#/http/json.ts";

// GET /api/health. A Lambda handler (API Gateway HTTP API, payload v2); see ADR 0006.
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  const body: HealthResponse = { status: "ok", version: process.env.APP_VERSION ?? "dev" };
  return jsonResponse(200, body);
}
