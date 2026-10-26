import type { HealthResponse } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
// The release number release-please keeps here. Bundled into the Lambda, and read as it is
// by the local and demo servers, so every environment reports the same number. Node only
// imports JSON whole, so the whole file is bundled: keep anything private out of it.
import rootPackage from "../../../package.json" with { type: "json" };

// GET /api/health. A Lambda handler (API Gateway HTTP API, payload v2); see ADR 0006.
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  const body: HealthResponse = { status: "ok", version: rootPackage.version };
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
