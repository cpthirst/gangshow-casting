import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { MicPlotStore } from "./mic-plot-store.ts";

// GET /api/productions/{productionId}/mic-plot: every item's channels given out
// (production-mics FR2), for anyone signed in.
export function createGetMicPlot(store: MicPlotStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    return jsonResponse(200, await store.list(productionId));
  };
}
