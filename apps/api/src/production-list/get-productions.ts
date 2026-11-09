import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { ProductionListStore } from "./production-list-store.ts";

// GET /api/productions: every production, for anyone signed in.
export function createGetProductions(store: ProductionListStore) {
  return async (_event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> =>
    jsonResponse(200, await store.list());
}
