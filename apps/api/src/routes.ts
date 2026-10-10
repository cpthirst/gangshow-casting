import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler as health } from "./health.ts";

// Handlers take no event yet; add the APIGatewayProxyEventV2 parameter when one needs input.
export type Handler = () => Promise<APIGatewayProxyStructuredResultV2>;

/** One entry per future API Gateway route: "<METHOD> <path>" → handler. */
export const routes: Record<string, Handler> = {
  "GET /api/health": health,
};
