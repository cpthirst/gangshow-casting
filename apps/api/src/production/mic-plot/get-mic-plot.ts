import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { MicPlotStore } from "./mic-plot-store.ts";

// GET /api/productions/{productionId}/mic-plot: every item's channels given out
// (production-mics FR2), for anyone signed in.
export function createGetMicPlot(store: MicPlotStore): Handler {
  return inProduction(async (productionId) => {
    return jsonResponse(200, await store.list(productionId));
  });
}
