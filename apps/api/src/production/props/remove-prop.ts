import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { productionIdOf, wholeNumber } from "#/http/params.ts";
import type { PropStore } from "./prop-store.ts";

// DELETE /api/productions/{productionId}/props/{propId}: take a prop off its item for good
// (production-props FR19). Only Stage or an admin get here (routeNeeds in @app/shared).
export function createRemoveProp(props: PropStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const propId = wholeNumber(event.pathParameters?.propId);
    if (productionId === undefined || propId === undefined) return { statusCode: 404 };

    const result = await props.remove(productionId, propId);
    return { statusCode: result === "removed" ? 204 : 404 };
  };
}
