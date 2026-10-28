import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { wholeNumber } from "#/http/params.ts";
import type { PropStore } from "./prop-store.ts";

// DELETE /api/productions/{productionId}/props/{propId}: take a prop off its item for good
// (production-props FR19). Only Stage or an admin get here (routeNeeds in @app/shared).
export function createRemoveProp(props: PropStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const propId = wholeNumber(event.pathParameters?.propId);
    if (!productionId.success || propId === undefined) return { statusCode: 404 };

    const result = await props.remove(productionId.data, propId);
    return { statusCode: result === "removed" ? 204 : 404 };
  };
}
