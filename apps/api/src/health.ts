import type { HealthResponse } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// GET /api/health. A Lambda handler (API Gateway HTTP API, payload v2); see ADR 0006.
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  const body: HealthResponse = { status: "ok", version: process.env.APP_VERSION ?? "dev" };
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
