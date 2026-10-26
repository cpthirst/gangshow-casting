import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import type { PropStore } from "./prop-store.ts";

// GET /api/productions/{productionId}/props: every item's props (stage-props FR13, FR15).
export function createGetProps(store: PropStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await store.list(productionId.data)),
    };
  };
}
